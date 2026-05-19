// LassanaPata POS - Tauri application entry point

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PrinterInfo {
    pub name: String,
    pub is_default: bool,
}

// ═══════════════════════════════════════════════════════════════════════════════
// Native Win32 printer bindings — winspool.drv
// No PowerShell, no console window, no flash.
// ═══════════════════════════════════════════════════════════════════════════════
#[cfg(windows)]
mod win32_print {
    #[link(name = "winspool")]
    extern "system" {
        pub fn GetDefaultPrinterW(pszBuffer: *mut u16, pcchBuffer: *mut u32) -> i32;
        pub fn SetDefaultPrinterW(pszPrinter: *const u16) -> i32;
        pub fn EnumPrintersW(
            Flags: u32,
            Name: *const u16,
            Level: u32,
            pPrinterEnum: *mut u8,
            cbBuf: u32,
            pcbNeeded: *mut u32,
            pcReturned: *mut u32,
        ) -> i32;
    }

    /// Mirrors PRINTER_INFO_4W layout from winspool.h
    #[repr(C)]
    #[allow(non_snake_case)]
    pub struct PrinterInfo4W {
        pub pPrinterName: *const u16,
        pub pServerName:  *const u16,
        pub Attributes:   u32,
    }

    pub fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    pub unsafe fn from_wide_ptr(ptr: *const u16) -> String {
        if ptr.is_null() {
            return String::new();
        }
        let mut len = 0usize;
        while *ptr.add(len) != 0 {
            len += 1;
        }
        String::from_utf16_lossy(std::slice::from_raw_parts(ptr, len))
    }

    pub const PRINTER_ENUM_LOCAL:       u32 = 0x0000_0002;
    pub const PRINTER_ENUM_CONNECTIONS: u32 = 0x0000_0004;
}

// ───────────────────────────────────────────────────────────────────────────────
// list_printers — native Win32, zero PowerShell, no window flash
// ───────────────────────────────────────────────────────────────────────────────
#[tauri::command]
fn list_printers() -> Result<Vec<PrinterInfo>, String> {
    #[cfg(windows)]
    {
        return list_printers_win32();
    }
    #[cfg(not(windows))]
    {
        return Ok(vec![]);
    }
}

#[cfg(windows)]
fn list_printers_win32() -> Result<Vec<PrinterInfo>, String> {
    use win32_print::*;
    unsafe {
        // ── Get current default printer name ─────────────────────────────────
        let mut def_len: u32 = 512;
        let mut def_buf: Vec<u16> = vec![0u16; def_len as usize];
        GetDefaultPrinterW(def_buf.as_mut_ptr(), &mut def_len);
        // Reads until null-terminator; returns "" if no default printer set
        let default_name = from_wide_ptr(def_buf.as_ptr());

        // ── Probe required buffer size ────────────────────────────────────────
        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let mut needed: u32 = 0;
        let mut count: u32 = 0;
        // First call always fails with ERROR_INSUFFICIENT_BUFFER — that's expected
        EnumPrintersW(flags, std::ptr::null(), 4,
            std::ptr::null_mut(), 0, &mut needed, &mut count);
        if needed == 0 {
            return Ok(vec![]);
        }

        // ── Enumerate into properly-sized buffer ──────────────────────────────
        let mut buf: Vec<u8> = vec![0u8; needed as usize];
        let ret = EnumPrintersW(flags, std::ptr::null(), 4,
            buf.as_mut_ptr(), needed, &mut needed, &mut count);
        if ret == 0 {
            return Err("EnumPrintersW failed".to_string());
        }

        // Pointers inside buf are valid while buf is alive
        let info_ptr = buf.as_ptr() as *const PrinterInfo4W;
        let mut printers = Vec::with_capacity(count as usize);
        for i in 0..count as usize {
            let info = &*info_ptr.add(i);
            let name = from_wide_ptr(info.pPrinterName);
            if name.is_empty() { continue; }
            let is_default = name == default_name;
            printers.push(PrinterInfo { name, is_default });
        }
        Ok(printers)
    }
}

// ───────────────────────────────────────────────────────────────────────────────
// set_default_printer — native Win32, zero PowerShell, no window flash
// ───────────────────────────────────────────────────────────────────────────────
#[tauri::command]
fn set_default_printer(printer_name: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use win32_print::*;
        let wide = to_wide(&printer_name);
        let ret = unsafe { SetDefaultPrinterW(wide.as_ptr()) };
        if ret == 0 {
            return Err(format!("SetDefaultPrinterW failed for '{printer_name}'"));
        }
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        return Err("Not supported on this platform".into());
    }
}


// ───────────────────────────────────────────────────────────────────────────────
// print_receipt_html
//
// How it works:
//   1. Write the receipt HTML to a temp file.
//   2. Set IE PageSetup registry so headers/footers are blank and margins are 0.
//   3. Switch the Windows default printer to the selected one.
//   4. Spawn a background thread that runs PowerShell with the hidden
//      System.Windows.Forms.WebBrowser control (Trident in-process).
//      No browser window appears — CreateControl() forces an off-screen render.
//   5. Return Ok(()) immediately.
// ───────────────────────────────────────────────────────────────────────────────
#[tauri::command]
async fn print_receipt_html(html: String, printer_name: String) -> Result<(), String> {
    // Write receipt HTML to temp file
    let temp_dir = std::env::temp_dir();
    let html_path = temp_dir.join("pos_receipt_print.html");
    std::fs::write(&html_path, html.as_bytes())
        .map_err(|e| format!("Write HTML: {e}"))?;

    let file_url = format!(
        "file:///{}",
        html_path.to_string_lossy().replace('\\', "/")
    );

    // Set IE PageSetup registry: blank header/footer, zero margins
    #[cfg(windows)]
    ie_page_setup_for_receipt()?;

    // Switch default printer
    #[cfg(windows)]
    {
        use win32_print::*;
        let wide = to_wide(&printer_name);
        unsafe { SetDefaultPrinterW(wide.as_ptr()) };
    }

    // Spawn background thread — PowerShell runs async, returns immediately
    std::thread::spawn(move || {
        #[cfg(windows)]
        powershell_webprint(&file_url, &printer_name);
    });

    Ok(())
}

// ── Set IE PageSetup registry for receipt printing ────────────────────────────
#[cfg(windows)]
fn ie_page_setup_for_receipt() -> Result<(), String> {
    use std::process::Command;
    // Use reg.exe — no external crate needed, runs in <10ms
    let key = r"HKCU\Software\Microsoft\Internet Explorer\PageSetup";
    let entries = [
        ("header", ""),
        ("footer", ""),
        ("margin_bottom", "0.000000"),
        ("margin_top",    "0.000000"),
        ("margin_left",   "0.000000"),
        ("margin_right",  "0.000000"),
    ];
    for (name, val) in &entries {
        Command::new("reg")
            .args(["add", key, "/v", name, "/t", "REG_SZ", "/d", val, "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok();
    }
    Ok(())
}

// ── Silent print via PowerShell WebBrowser control ───────────────────────────
//
// System.Windows.Forms.WebBrowser wraps the Trident engine in-process.
// CreateControl() forces the control to be realised without any visible window.
// No browser window, no taskbar entry, no dialog — completely silent.
// For PDF printers the driver itself opens the "Save As" dialog (expected).
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(windows)]
fn powershell_webprint(url: &str, printer_name: &str) {
    // Escape any single quotes for PowerShell string literals
    let safe_url     = url.replace('\'', "''");
    let safe_printer = printer_name.replace('\'', "''");

    // Save current duplex, force simplex, print, then restore duplex.
    let script = format!(
        "$pn = '{safe_printer}'; \
        $od = (Get-PrintConfiguration -PrinterName $pn -ErrorAction SilentlyContinue).DuplexingMode; \
        Set-PrintConfiguration -PrinterName $pn -DuplexingMode OneSided -ErrorAction SilentlyContinue; \
        Add-Type -AssemblyName System.Windows.Forms; \
        $wb = New-Object System.Windows.Forms.WebBrowser; \
        $wb.ScriptErrorsSuppressed = $true; \
        $wb.CreateControl(); \
        $wb.Navigate('{safe_url}'); \
        $sw = [System.Diagnostics.Stopwatch]::StartNew(); \
        while ($wb.ReadyState -ne 'Complete' -and $sw.Elapsed.TotalSeconds -lt 15) {{ \
            [System.Windows.Forms.Application]::DoEvents(); \
            Start-Sleep -Milliseconds 50 \
        }}; \
        Start-Sleep -Milliseconds 400; \
        $wb.Print(); \
        Start-Sleep -Seconds 3; \
        $wb.Dispose(); \
        if ($od -and $od -ne 'OneSided') {{ \
            Set-PrintConfiguration -PrinterName $pn -DuplexingMode $od -ErrorAction SilentlyContinue \
        }}"
    );

    let _ = std::process::Command::new("powershell")
        .args([
            "-WindowStyle", "Hidden",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy", "Bypass",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
}

// ── Customer display window ───────────────────────────────────────────────────
#[tauri::command]
async fn open_customer_display(app: tauri::AppHandle) -> Result<(), String> {
    // If window already exists, just show + focus it
    if let Some(win) = app.get_webview_window("customer-display") {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Dev: connect to the Vite dev server; Release: load bundled index.html
    #[cfg(debug_assertions)]
    let url = tauri::WebviewUrl::External(
        "http://localhost:1420"
            .parse::<url::Url>()
            .map_err(|e| e.to_string())?,
    );
    #[cfg(not(debug_assertions))]
    let url = tauri::WebviewUrl::App(std::path::PathBuf::from("index.html"));

    tauri::WebviewWindowBuilder::new(&app, "customer-display", url)
        .title("Customer Display - ZynkPOS")
        .inner_size(1200.0, 768.0)
        .min_inner_size(800.0, 500.0)
        .resizable(true)
        .decorations(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_customer_display(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("customer-display") {
        // Use destroy() instead of close() to bypass the onCloseRequested
        // handler in the customer display window (which calls preventDefault).
        win.destroy().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            list_printers,
            set_default_printer,
            print_receipt_html,
            open_customer_display,
            close_customer_display,
        ])
        .setup(|app| {
            // Close customer display automatically when the main POS window closes
            let app_handle = app.handle().clone();
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Destroyed = event {
                        if let Some(cd) = app_handle.get_webview_window("customer-display") {
                            let _ = cd.close();
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LassanaPata POS")
}
