import { useRef } from "react";

/**
 * Six-digit verification code input (Form-compatible: value / onChange).
 * Big monochrome cells split 3 · 3; typing advances, Backspace goes back,
 * arrow keys move, and pasting a full code fills every cell.
 * Calls onComplete(code) once all digits are entered.
 */
export default function CodeInput({ value = "", onChange, onComplete, length = 6, disabled, autoFocus, status }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const commit = (next) => {
    const code = next.join("").slice(0, length);
    onChange?.(code);
    if (code.length === length && !next.includes("")) onComplete?.(code);
  };

  const fillFrom = (start, text) => {
    const clean = text.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    for (let k = 0; k < clean.length && start + k < length; k++) next[start + k] = clean[k];
    commit(next);
    focus(Math.min(start + clean.length, length - 1));
  };

  const onKeyDown = (i, e) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = "";
      } else if (i > 0) {
        next[i - 1] = "";
        focus(i - 1);
      }
      commit(next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault(); focus(i - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault(); focus(i + 1);
    }
  };

  const half = Math.ceil(length / 2);

  return (
    <div className="code-input" role="group" aria-label={`${length}-digit verification code`}>
      {digits.map((d, i) => (
        <span key={i} className="contents">
          {i === half && <span className="code-input__sep" aria-hidden="true" />}
          <input
            ref={(el) => { refs.current[i] = el; }}
            className={`code-input__cell${d ? " is-filled" : ""}${status === "error" ? " is-error" : ""}`}
            value={d}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={length}
            disabled={disabled}
            autoFocus={autoFocus && i === 0}
            aria-label={`Digit ${i + 1}`}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => { e.preventDefault(); fillFrom(i, e.clipboardData.getData("text")); }}
            onChange={(e) => {
              const v = e.target.value;
              // One new key typed into a filled cell → keep just that digit; longer = autofill.
              fillFrom(i, v.length === 2 ? v.slice(-1) : v);
            }}
          />
        </span>
      ))}
    </div>
  );
}
