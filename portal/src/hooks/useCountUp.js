import { useState, useEffect, useRef } from 'react';

/**
 * A hook that animates a number value from 0 to the target value
 * @param {number} end - The target value to count to
 * @param {number} duration - The duration of the animation in milliseconds (default: 2000)
 * @param {number} delay - Delay before starting animation in milliseconds (default: 0)
 * @returns {number} - The current animated value
 */
export default function useCountUp(end, duration = 2000, delay = 0) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);
  const startTimeRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Intersection Observer to start animation when element is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  // Animation logic
  useEffect(() => {
    // Validate end parameter
    const targetValue = typeof end === 'number' && !isNaN(end) && isFinite(end) ? end : 0;

    if (!isVisible || targetValue === 0) return;

    const timer = setTimeout(() => {
      startTimeRef.current = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (easeOutQuart) for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * targetValue));

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          setCount(targetValue);
        }
      };

      animationFrameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible, end, duration, delay]);

  return { count, ref };
}

/**
 * A simpler version that returns just the count (no ref needed)
 * Useful for cards that are already visible on mount
 */
export function useCountUpSimple(end, duration = 2000, delay = 0) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Validate end parameter
    const targetValue = typeof end === 'number' && !isNaN(end) && isFinite(end) ? end : 0;

    if (targetValue === 0) return;

    const timer = setTimeout(() => {
      const startTime = performance.now();

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (easeOutQuart)
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(easeOutQuart * targetValue));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(targetValue);
        }
      };

      requestAnimationFrame(animate);
    }, delay);

    return () => clearTimeout(timer);
  }, [end, duration, delay]);

  const target = typeof end === 'number' && !isNaN(end) && isFinite(end) ? end : 0;
  return target === 0 ? 0 : count;
}
