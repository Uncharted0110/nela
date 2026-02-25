//! Audio commands — TTS generation and speech-to-text.
//!
//! These are convenience wrappers around route_request for audio-specific tasks.

use crate::commands::inference::TaskRouterState;
use crate::registry::types::{TaskRequest, TaskType};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::collections::HashMap;
use tauri::State;

/// Generate speech from text using the KittenTTS engine.
///
/// # Arguments
/// * `input` — Text to synthesize
/// * `voice` — Optional voice name (e.g. "Leo", "Bella")
/// * `speed` — Optional speaking speed (e.g. 1.0)
///
/// # Returns
/// A `data:audio/wav;base64,…` URL that can be used directly in an `<audio>` element.
#[tauri::command]
pub async fn generate_speech(
    input: String,
    voice: Option<String>,
    speed: Option<f32>,
    router_state: State<'_, TaskRouterState>,
) -> Result<String, String> {
    let mut extra = HashMap::new();

    if let Some(v) = voice {
        extra.insert("voice".to_string(), v);
    }
    if let Some(s) = speed {
        extra.insert("speed".to_string(), s.to_string());
    }

    let request = TaskRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        task_type: TaskType::Tts,
        input,
        model_override: None,
        extra,
    };

    let file_path = match router_state.0.route(&request).await? {
        crate::registry::types::TaskResponse::FilePath(path) => path,
        other => return Err(format!("Unexpected TTS response: {other:?}")),
    };

    // Read the WAV file and return it as a base64 data URL so the webview can
    // play it without needing asset-protocol scope permissions.
    let wav_bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read generated WAV file: {e}"))?;
    let b64 = STANDARD.encode(&wav_bytes);

    // Clean up the temp file (best-effort)
    let _ = std::fs::remove_file(&file_path);

    Ok(format!("data:audio/wav;base64,{b64}"))
}

/// Transcribe an audio file to text using Whisper.
///
/// # Arguments
/// * `audio_path` — Absolute path to the audio file
///
/// # Returns
/// Transcription result with timestamps.
#[tauri::command]
pub async fn transcribe_audio(
    audio_path: String,
    router_state: State<'_, TaskRouterState>,
) -> Result<crate::registry::types::TaskResponse, String> {
    let request = TaskRequest {
        request_id: uuid::Uuid::new_v4().to_string(),
        task_type: TaskType::Transcribe,
        input: audio_path,
        model_override: None,
        extra: HashMap::new(),
    };

    router_state.0.route(&request).await
}
