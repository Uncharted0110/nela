//! PDF text extraction using pdf-extract.

use std::path::Path;
use super::{ParsedDocument, TextBlock};

pub fn parse(path: &Path) -> Result<ParsedDocument, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("Failed to read PDF: {e}"))?;
    let text = pdf_extract::extract_text_from_mem(&bytes)
        .map_err(|e| format!("PDF extraction error: {e}"))?;

    // Log raw extracted text for debugging
    log::debug!("PDF raw text length: {} chars", text.len());
    log::debug!("PDF raw text preview (first 500 chars):\n{}", 
        text.chars().take(500).collect::<String>());

    let title = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("document.pdf")
        .to_string();

    // Split into pages by form-feed character (common PDF separator),
    // falling back to double-newline paragraph splitting.
    let sections: Vec<TextBlock> = if text.contains('\u{000C}') {
        text.split('\u{000C}')
            .enumerate()
            .filter(|(_, page)| !page.trim().is_empty())
            .map(|(i, page)| TextBlock {
                text: page.trim().to_string(),
                metadata: format!("page:{}", i + 1),
            })
            .collect()
    } else {
        // No form-feeds — split by double newline into paragraphs
        text.split("\n\n")
            .filter(|p| !p.trim().is_empty())
            .enumerate()
            .map(|(i, para)| TextBlock {
                text: para.trim().to_string(),
                metadata: format!("paragraph:{}", i + 1),
            })
            .collect()
    };

    log::debug!("PDF parsed into {} sections", sections.len());
    for (i, sec) in sections.iter().take(3).enumerate() {
        log::debug!("Section {}: {} chars, metadata: {}, preview: {}", 
            i + 1, 
            sec.text.len(), 
            sec.metadata,
            sec.text.chars().take(100).collect::<String>()
        );
    }

    Ok(ParsedDocument { title, sections })
}
