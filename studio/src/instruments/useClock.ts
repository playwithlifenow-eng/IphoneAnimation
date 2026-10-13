import { useCallback, useEffect, useRef, useState } from "react";
import { clamp } from "./engine";
export function useClock(weight: number, reduced: boolean) {
  const [progress, setProgress] = useState(0.36),
    [velocity, setVelocity] = useState(0),
    [playing, setPlaying] = useState(false);
  const live = useRef({
    value: 0.36,
    target: 0.36,
    velocity: 0,
    last: 0,
    frame: 0,
    playing: false,
    weight,
    reduced,
  });
  live.current.weight = weight;
  live.current.reduced = reduced;
  const tick = useCallback((now: number) => {
    const l = live.current,
      dt = Math.min(0.5, (now - (l.last || now - 16)) / 1000);
    l.last = now;
    if (l.playing) {
      l.target = clamp(l.target + dt / 10);
      if (l.target >= 1) {
        l.playing = false;
        setPlaying(false);
      }
    }
    const prev = l.value,
      tau = l.reduced || l.weight === 0 ? 0 : 0.04 + l.weight * 0.5;
    l.value = tau
      ? l.value + (l.target - l.value) * (1 - Math.exp(-dt / tau))
      : l.target;
    if (Math.abs(l.value - l.target) < 0.0001) l.value = l.target;
    l.velocity = ((l.value - prev) / Math.max(dt, 0.001)) * 8;
    setProgress(l.value);
    setVelocity(l.velocity);
    if (l.playing || l.value !== l.target || Math.abs(l.velocity) > 0.001)
      l.frame = requestAnimationFrame(tick);
    else {
      l.frame = 0;
      l.last = 0;
      setVelocity(0);
    }
  }, []);
  const wake = () => {
    const l = live.current;
    if (!l.frame) l.frame = requestAnimationFrame(tick);
  };
  const seek = (value: number, immediate = false) => {
    const l = live.current;
    l.target = clamp(value);
    if (immediate) {
      l.value = l.target;
      setProgress(l.value);
      setVelocity(0);
    }
    wake();
  };
  const play = () => {
    const l = live.current;
    l.playing = !l.playing;
    if (l.playing && l.value > 0.999) {
      l.value = 0;
      l.target = 0;
    }
    setPlaying(l.playing);
    wake();
  };
  useEffect(() => () => cancelAnimationFrame(live.current.frame), []);
  return {
    progress,
    velocity,
    playing,
    seek,
    play,
    target: () => live.current.target,
  };
}
