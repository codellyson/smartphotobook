#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// SmartPhotobook desktop shell.
//
// `lib/platform.ts` detects `window.__TAURI__` and fans out to native dialogs +
// filesystem when present. The frontend is a Next.js static export under
// `../out` (see `tauri.conf.json`).

use base64::Engine as _;
use printpdf::{
    image_crate::DynamicImage, Color, Image as PdfImage, ImageTransform, Line, Mm, PdfDocument,
    PdfLayerReference, Point, Rgb,
};
use std::fs::File;
use std::io::BufWriter;

fn mm(v: f64) -> Mm {
    Mm(v as f32)
}

/// Convert pixel dimensions into mm assuming 72 DPI (printpdf's image placement
/// convention: 1 image pixel == 1 PDF point, 72 points == 1 inch).
fn px_to_mm_at_72dpi(px: u32) -> f64 {
    (px as f64) * 25.4 / 72.0
}

fn draw_crop_marks(layer: &PdfLayerReference, w_mm: f64, h_mm: f64, bleed_mm: f64) {
    if bleed_mm <= 0.0 {
        return;
    }
    layer.set_outline_color(Color::Rgb(Rgb::new(0.0, 0.0, 0.0, None)));
    layer.set_outline_thickness(0.25);

    let gap: f64 = 1.0; // mm gap from trim edge so marks sit clear of artwork
    // Trim box corners in page coordinates (origin bottom-left in printpdf).
    let trim_x0 = bleed_mm;
    let trim_y0 = bleed_mm;
    let trim_x1 = w_mm - bleed_mm;
    let trim_y1 = h_mm - bleed_mm;
    // Each corner gets one horizontal and one vertical tick on the outer side
    // of the trim, fully within the bleed margin.
    let outer_low_w = (bleed_mm - gap).max(0.0); // mm into the bleed
    let outer_low_h = (bleed_mm - gap).max(0.0);

    let segments: [(f64, f64, f64, f64); 8] = [
        // bottom-left: vertical down, horizontal left
        (trim_x0, trim_y0 - gap, trim_x0, trim_y0 - gap - outer_low_h),
        (trim_x0 - gap, trim_y0, trim_x0 - gap - outer_low_w, trim_y0),
        // bottom-right
        (trim_x1, trim_y0 - gap, trim_x1, trim_y0 - gap - outer_low_h),
        (trim_x1 + gap, trim_y0, trim_x1 + gap + outer_low_w, trim_y0),
        // top-left
        (trim_x0, trim_y1 + gap, trim_x0, trim_y1 + gap + outer_low_h),
        (trim_x0 - gap, trim_y1, trim_x0 - gap - outer_low_w, trim_y1),
        // top-right
        (trim_x1, trim_y1 + gap, trim_x1, trim_y1 + gap + outer_low_h),
        (trim_x1 + gap, trim_y1, trim_x1 + gap + outer_low_w, trim_y1),
    ];

    for (x1, y1, x2, y2) in segments {
        layer.add_line(Line {
            points: vec![
                (Point::new(mm(x1), mm(y1)), false),
                (Point::new(mm(x2), mm(y2)), false),
            ],
            is_closed: false,
        });
    }
}

#[tauri::command]
fn export_album_pdf(
    path: String,
    pages: Vec<String>,    // base64 JPEG bytes, one per spread
    page_width_mm: f64,    // spread width without bleed
    page_height_mm: f64,   // spread height without bleed
    bleed_mm: f64,
) -> Result<(), String> {
    if pages.is_empty() {
        return Err("No spreads to export".into());
    }
    let total_w = page_width_mm + bleed_mm * 2.0;
    let total_h = page_height_mm + bleed_mm * 2.0;

    let (doc, first_page, first_layer) =
        PdfDocument::new("SmartPhotobook", mm(total_w), mm(total_h), "Layer 1");

    let b64 = base64::engine::general_purpose::STANDARD;

    for (i, jpeg_b64) in pages.iter().enumerate() {
        let jpeg_bytes = b64
            .decode(jpeg_b64)
            .map_err(|e| format!("invalid base64 on page {}: {}", i + 1, e))?;
        let dynamic: DynamicImage = printpdf::image_crate::load_from_memory(&jpeg_bytes)
            .map_err(|e| format!("decode page {} failed: {}", i + 1, e))?;

        let (page_idx, layer_idx) = if i == 0 {
            (first_page, first_layer)
        } else {
            doc.add_page(mm(total_w), mm(total_h), format!("Layer {}", i + 1))
        };
        let layer = doc.get_page(page_idx).get_layer(layer_idx);

        // Image scale: printpdf places `1 pixel == 1 point` by default
        // (72 DPI). Fit the rendered JPEG to the entire page area.
        let img_w_mm_at_1x = px_to_mm_at_72dpi(dynamic.width());
        let img_h_mm_at_1x = px_to_mm_at_72dpi(dynamic.height());
        let scale_x = (total_w / img_w_mm_at_1x) as f32;
        let scale_y = (total_h / img_h_mm_at_1x) as f32;

        let pdf_image = PdfImage::from_dynamic_image(&dynamic);
        pdf_image.add_to_layer(
            layer.clone(),
            ImageTransform {
                translate_x: Some(mm(0.0)),
                translate_y: Some(mm(0.0)),
                scale_x: Some(scale_x),
                scale_y: Some(scale_y),
                rotate: None,
                dpi: Some(300.0),
            },
        );

        draw_crop_marks(&layer, total_w, total_h, bleed_mm);
    }

    let file = File::create(&path).map_err(|e| format!("create {}: {}", path, e))?;
    let mut writer = BufWriter::new(file);
    doc.save(&mut writer).map_err(|e| format!("save pdf: {}", e))?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![export_album_pdf])
        .run(tauri::generate_context!())
        .expect("error while running SmartPhotobook");
}
