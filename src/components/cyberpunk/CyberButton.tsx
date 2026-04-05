'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const cyberButtonVariants = cva(
  // Base styles with cyberpunk aesthetics
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold uppercase tracking-wider transition-all duration-300 disabled:pointer-events-none disabled:opacity-50 overflow-hidden group',
  {
    variants: {
      variant: {
        // Primary - Neon Purple (#bc13fe)
        default: [
          'bg-[#bc13fe] text-white',
          'border-2 border-[#bc13fe]',
          'shadow-[0_0_25px_rgba(188,19,254,0.5),0_0_50px_rgba(188,19,254,0.2)]',
          'hover:bg-[#d44fff] hover:border-[#d44fff]',
          'hover:shadow-[0_0_35px_rgba(188,19,254,0.7),0_0_70px_rgba(188,19,254,0.4)]',
          'active:scale-[0.98] active:shadow-[0_0_20px_rgba(188,19,254,0.6)]',
          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
          'before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700',
        ].join(' '),
        
        // Secondary - Neon Cyan (#00f7ff)
        cyan: [
          'bg-[#00f7ff] text-black',
          'border-2 border-[#00f7ff]',
          'shadow-[0_0_25px_rgba(0,247,255,0.5),0_0_50px_rgba(0,247,255,0.2)]',
          'hover:bg-[#5cffff] hover:border-[#5cffff]',
          'hover:shadow-[0_0_35px_rgba(0,247,255,0.7),0_0_70px_rgba(0,247,255,0.4)]',
          'active:scale-[0.98]',
          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
          'before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700',
        ].join(' '),
        
        // Neon Pink (#ff44cc)
        magenta: [
          'bg-[#ff44cc] text-white',
          'border-2 border-[#ff44cc]',
          'shadow-[0_0_25px_rgba(255,68,204,0.5),0_0_50px_rgba(255,68,204,0.2)]',
          'hover:bg-[#ff77dd] hover:border-[#ff77dd]',
          'hover:shadow-[0_0_35px_rgba(255,68,204,0.7),0_0_70px_rgba(255,68,204,0.4)]',
          'active:scale-[0.98]',
          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent',
          'before:translate-x-[-200%] hover:before:translate-x-[200%] before:transition-transform before:duration-700',
        ].join(' '),
        
        // Purple neon - alternate
        purple: [
          'bg-gradient-to-r from-[#bc13fe] to-[#ff44cc] text-white',
          'border-2 border-[#bc13fe]',
          'shadow-[0_0_25px_rgba(188,19,254,0.5),0_0_50px_rgba(255,68,204,0.3)]',
          'hover:shadow-[0_0_40px_rgba(188,19,254,0.7),0_0_80px_rgba(255,68,204,0.5)]',
          'hover:border-[#ff44cc]',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Destructive - Neon Red (#ff3366)
        destructive: [
          'bg-[#ff3366] text-white',
          'border-2 border-[#ff3366]',
          'shadow-[0_0_25px_rgba(255,51,102,0.5),0_0_50px_rgba(255,51,102,0.2)]',
          'hover:bg-[#ff6688] hover:border-[#ff6688]',
          'hover:shadow-[0_0_35px_rgba(255,51,102,0.7),0_0_70px_rgba(255,51,102,0.4)]',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Success - Neon Green (#00ff88)
        success: [
          'bg-[#00ff88] text-black',
          'border-2 border-[#00ff88]',
          'shadow-[0_0_25px_rgba(0,255,136,0.5),0_0_50px_rgba(0,255,136,0.2)]',
          'hover:bg-[#5cffaa] hover:border-[#5cffaa]',
          'hover:shadow-[0_0_35px_rgba(0,255,136,0.7),0_0_70px_rgba(0,255,136,0.4)]',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Warning - Neon Orange
        warning: [
          'bg-[#ffaa00] text-black',
          'border-2 border-[#ffaa00]',
          'shadow-[0_0_25px_rgba(255,170,0,0.5),0_0_50px_rgba(255,170,0,0.2)]',
          'hover:bg-[#ffcc44] hover:border-[#ffcc44]',
          'hover:shadow-[0_0_35px_rgba(255,170,0,0.7),0_0_70px_rgba(255,170,0,0.4)]',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Outline with neon purple border
        outline: [
          'bg-transparent text-[#bc13fe]',
          'border-2 border-[#bc13fe]/60',
          'shadow-[0_0_15px_rgba(188,19,254,0.2)]',
          'hover:bg-[#bc13fe]/15 hover:border-[#bc13fe]',
          'hover:shadow-[0_0_25px_rgba(188,19,254,0.4)]',
          'hover:text-[#d44fff]',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Ghost with minimal styling
        ghost: [
          'bg-transparent text-white/80',
          'border-2 border-transparent',
          'hover:bg-[#bc13fe]/10 hover:text-[#bc13fe]',
          'hover:border-[#bc13fe]/30',
          'active:scale-[0.98]',
        ].join(' '),
        
        // Link style
        link: [
          'bg-transparent text-[#00f7ff] underline-offset-4',
          'border-none shadow-none',
          'hover:underline hover:text-[#5cffff]',
          'drop-shadow-[0_0_10px_rgba(0,247,255,0.5)]',
        ].join(' '),
        
        // Glassmorphism button
        glass: [
          'bg-white/5 backdrop-blur-xl text-white',
          'border-2 border-[#bc13fe]/20',
          'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          'hover:bg-[#bc13fe]/10 hover:border-[#bc13fe]/40',
          'hover:shadow-[0_0_25px_rgba(188,19,254,0.3)]',
          'active:scale-[0.98]',
        ].join(' '),
      },
      size: {
        default: 'h-10 px-6 py-2.5 text-xs rounded-lg',
        sm: 'h-8 px-4 text-[10px] rounded-md',
        lg: 'h-12 px-8 text-sm rounded-xl',
        xl: 'h-14 px-10 text-base rounded-xl',
        icon: 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-lg': 'h-12 w-12 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface CyberButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof cyberButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
  glowPulse?: boolean;
}

const CyberButton = React.forwardRef<HTMLButtonElement, CyberButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, glowPulse = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    
    return (
      <Comp
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          cyberButtonVariants({ variant, size }),
          glowPulse && 'animate-neon-pulse',
          className
        )}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-inherit">
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <span className={cn('flex items-center gap-2', loading && 'invisible')}>
          {children}
        </span>
      </Comp>
    );
  }
);

CyberButton.displayName = 'CyberButton';

export { CyberButton, cyberButtonVariants };
