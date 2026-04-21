'use client';

import React, { useRef, ReactNode } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(useGSAP);

interface CyberStaggerProps {
  children: ReactNode;
  staggerDelay?: number;
  yOffset?: number;
  duration?: number;
  className?: string;
}

export function CyberStagger({
  children,
  staggerDelay = 0.1,
  yOffset = 30,
  duration = 0.5,
  className = '',
}: CyberStaggerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // Get all direct children
    const elements = containerRef.current.children;

    gsap.fromTo(
      elements,
      {
        y: yOffset,
        opacity: 0,
        filter: 'blur(10px)',
      },
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: duration,
        stagger: staggerDelay,
        ease: 'back.out(1.2)',
        clearProps: 'filter,transform', // Clean up after animation to prevent layout issues
      }
    );
  }, { scope: containerRef });

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

// Higher order component to animate single elements
export function CyberFadeUp({
  children,
  delay = 0,
  yOffset = 30,
  duration = 0.6,
  className = '',
}: Omit<CyberStaggerProps, 'staggerDelay'> & { delay?: number }) {
  const elRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!elRef.current) return;

    gsap.fromTo(
      elRef.current,
      {
        y: yOffset,
        opacity: 0,
        filter: 'blur(10px)',
      },
      {
        y: 0,
        opacity: 1,
        filter: 'blur(0px)',
        duration: duration,
        delay: delay,
        ease: 'power3.out',
        clearProps: 'filter,transform',
      }
    );
  }, { scope: elRef });

  return (
    <div ref={elRef} className={className}>
      {children}
    </div>
  );
}
