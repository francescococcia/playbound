import { Component, type ReactNode } from "react";

/**
 * Keeps a failed external load (sky, model, bot) from taking the whole app down. Without it a 404
 * inside the canvas unmounts the React root. `fallback` is what stays visible, e.g. the grey box.
 */
export class SceneBoundary extends Component<{ fallback?: ReactNode; label?: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn(`[scene] ${this.props.label ?? "asset"} failed to load, keeping the fallback:`, error);
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** Self-hosted sky (drei's default preset URL points at a third-party CDN that can 404 or be blocked). */
export const SKY_HDR = "/assets/env/potsdamer_platz_1k.hdr";
