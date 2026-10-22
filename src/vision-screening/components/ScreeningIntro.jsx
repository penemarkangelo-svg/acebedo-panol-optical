import { useEffect } from "react";

import {
  SunIcon,
  LaptopIcon,
  CardIcon,
  CameraIcon,
} from "@solar-icons/react/linear";

const NEEDS = [
  {
    title: "Room and lighting",
    text: "Choose a well-lit space and avoid glare on your screen.",
    icon: SunIcon,
  },
  {
    title: "Device and screen",
    text: "Use a desktop or laptop. Keep browser zoom at 100% and don’t change it during the test.",
    icon: LaptopIcon,
  },
  {
    title: "Calibration",
    text: "Have a standard bank card ready to align with the on-screen guide.",
    icon: CardIcon,
  },
  {
    title: "Webcam",
    text: "Your webcam checks your position. Video stays on this device and is not stored.",
    icon: CameraIcon,
  },
];

export default function ScreeningIntro({ onStart, onClose }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="acebedo-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vision-screening-title"
    >
      <section className="acebedo-dialog acebedo-intro-dialog">
        <div className="acebedo-dialog-content acebedo-intro-content">
          {/* Header */}
          <header className="acebedo-intro-header">
            <p className="acebedo-eyebrow">
              Preliminary vision screening
            </p>

            <h1
              id="vision-screening-title"
              className="acebedo-heading-sm acebedo-intro-title"
            >
              Let’s Check Your Vision
            </h1>
          </header>

          {/* Preparation */}
          <section
            className="acebedo-intro-preparation"
            aria-labelledby="preparation-title"
          >
            <h2
              id="preparation-title"
              className="acebedo-intro-label"
            >
              Before you begin
            </h2>

            <div className="acebedo-intro-grid">
              {NEEDS.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="acebedo-intro-tile"
                  >
                    <div className="acebedo-intro-item-header">
                      <Icon
                        size={22}
                        color="var(--acebedo-red);"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />

                      <h3 className="acebedo-intro-item-title">
                        {item.title}
                      </h3>
                    </div>

                    <p className="acebedo-intro-copy">
                      {item.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Disclaimer */}
          <p className="acebedo-intro-disclaimer">
            <span className="acebedo-text-strong">
              Please note.
            </span>{" "}
            This is a preliminary digital screening only. It does not
            diagnose eye conditions or provide a prescription. A
            comprehensive eye examination is needed for a full
            assessment of your vision.
          </p>

          {/* Actions */}
          <footer className="acebedo-intro-actions">
            <button
              type="button"
              onClick={onClose}
              className="acebedo-btn acebedo-btn-quiet"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onStart}
              className="acebedo-btn acebedo-btn-primary acebedo-intro-start"
              autoFocus
            >
              Begin screening
            </button>
          </footer>
        </div>
      </section>
    </div>
  );
}