import { useEffect, useId, useMemo, useRef, useState } from 'react';

function isImageFile(file) {
  return Boolean(file && file.type && file.type.startsWith('image/'));
}

function useObjectUrl(fileOrUrl) {
  const url = useMemo(() => {
    if (!fileOrUrl) return '';
    if (typeof fileOrUrl === 'string') return fileOrUrl;
    return URL.createObjectURL(fileOrUrl);
  }, [fileOrUrl]);

  useEffect(() => {
    if (!fileOrUrl || typeof fileOrUrl === 'string') return undefined;
    return () => URL.revokeObjectURL(url);
  }, [fileOrUrl, url]);

  return url;
}

/**
 * Square click + drag-and-drop image upload zone.
 * Opens the system file picker on click (device / Drive / etc. when the OS offers them).
 */
export default function ImageUploadZone({
  id,
  label = 'Upload',
  accept = 'image/*',
  multiple = false,
  maxFiles = 1,
  files = [],
  previewUrl = '',
  busy = false,
  disabled = false,
  hint = 'Click or drag and drop',
  onFiles,
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const locked = busy || disabled;

  const localPreview = useObjectUrl(!multiple && !previewUrl ? files[0] : null);
  const singlePreview = !multiple ? previewUrl || localPreview : '';

  const thumbUrls = useMemo(
    () => (multiple ? files.map((file) => URL.createObjectURL(file)) : []),
    [files, multiple],
  );

  useEffect(() => {
    if (!multiple) return undefined;
    return () => {
      thumbUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [thumbUrls, multiple]);

  function emit(nextFiles) {
    if (!onFiles) return;
    const images = nextFiles.filter(isImageFile);
    if (!images.length) return;
    if (multiple) {
      onFiles([...files, ...images].slice(0, maxFiles));
    } else {
      onFiles([images[0]]);
    }
  }

  function onInputChange(e) {
    emit(Array.from(e.target.files || []));
    e.target.value = '';
  }

  function onDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    if (locked) return;
    setDragging(true);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    if (locked) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setDragging(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragging(false);
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (locked) return;
    emit(Array.from(e.dataTransfer?.files || []));
  }

  function openPicker() {
    if (locked) return;
    inputRef.current?.click();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openPicker();
    }
  }

  function removeAt(index) {
    if (locked || !multiple) return;
    onFiles(files.filter((_, i) => i !== index));
  }

  const remaining = multiple ? Math.max(0, maxFiles - files.length) : 1;
  const canAddMore = !multiple || remaining > 0;

  return (
    <div className={`image-upload${locked ? ' is-busy' : ''}${dragging ? ' is-dragging' : ''}`}>
      <input
        ref={inputRef}
        id={inputId}
        className="visually-hidden"
        type="file"
        accept={accept}
        multiple={Boolean(multiple && remaining > 1)}
        disabled={locked || !canAddMore}
        onChange={onInputChange}
      />

      {canAddMore ? (
        <button
          type="button"
          className="image-upload-zone"
          onClick={openPicker}
          onKeyDown={onKeyDown}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          disabled={locked}
          aria-label={label}
          aria-describedby={`${inputId}-hint`}
        >
          {singlePreview ? (
            <>
              <img className="image-upload-zone-preview" src={singlePreview} alt="" />
              <span className="image-upload-zone-overlay">
                <span className="image-upload-zone-title">{busy ? 'Uploading…' : label}</span>
                {!busy ? <span className="image-upload-zone-hint">{hint}</span> : null}
              </span>
            </>
          ) : (
            <span className="image-upload-zone-empty">
              <span className="image-upload-zone-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 16V4m0 0l-3.5 3.5M12 4l3.5 3.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M4 14.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="image-upload-zone-title">{busy ? 'Uploading…' : label}</span>
              <span id={`${inputId}-hint`} className={busy ? 'visually-hidden' : 'image-upload-zone-hint'}>
                {hint}
              </span>
            </span>
          )}
        </button>
      ) : null}

      {multiple && files.length ? (
        <ul className="image-upload-thumbs" aria-label="Selected photos">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}-${index}`} className="image-upload-thumb">
              <img src={thumbUrls[index]} alt="" />
              <button
                type="button"
                className="image-upload-thumb-remove"
                onClick={() => removeAt(index)}
                disabled={locked}
                aria-label={`Remove ${file.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {multiple ? (
        <p className="image-upload-meta muted-link">
          {files.length
            ? `${files.length} of ${maxFiles} photo${files.length === 1 ? '' : 's'} selected`
            : `Up to ${maxFiles} photos`}
        </p>
      ) : null}
    </div>
  );
}
