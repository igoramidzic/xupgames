import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer select-none items-center justify-center border bg-clip-padding text-sm font-medium whitespace-nowrap outline-none transition-[transform,box-shadow,border-color,background-color,color] duration-150 active:translate-y-[3px] active:shadow-none! focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[rgb(49_85_217/30%)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:translate-y-0 aria-invalid:border-[#d43c45] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'rounded-[12px_9px_13px_10px] border-[#2748bd] bg-[#3155d9] font-[760] text-white shadow-[0_5px_0_#1838aa] hover:bg-[#2549cc]',
        brand:
          'rounded-[12px_9px_13px_10px] border-[#2748bd] bg-[#3155d9] font-[760] text-white shadow-[0_5px_0_#1838aa] hover:bg-[#2549cc]',
        'brand-compact':
          'rounded-[9px] border-[#2748bd] bg-[#3155d9] font-[760] text-white shadow-[0_4px_0_#1f3b9e] hover:bg-[#294bc5]',
        outline:
          'rounded-[9px] border-[#c9d2e0] bg-white font-[680] text-[#4b5770] shadow-[0_3px_0_#d7deea] hover:border-[#abb7ca] hover:bg-[#f7f9fc] hover:text-[#17203a]',
        paper:
          'rounded-[9px] border-[#c9d2e0] bg-white font-[680] text-[#4b5770] shadow-[0_3px_0_#d7deea] hover:border-[#abb7ca] hover:bg-[#f7f9fc] hover:text-[#17203a]',
        'type-paper':
          'rounded-[8px_11px_9px_10px] border-[#b8c5e6] bg-white font-[680] text-[#5c5470] shadow-[0_3px_0_#c7d3ef] focus-visible:outline-[rgb(255_92_87/30%)] hover:border-[#8fa0cf] hover:bg-[#f7f8ff]',
        secondary:
          'rounded-[10px_7px_11px_8px] border-[#17203a] bg-[#f3cb42] font-[800] text-[#17203a] shadow-[3px_3px_0_#17203a] enabled:hover:bg-[#f8d75e]',
        sunny:
          'rounded-[10px_7px_11px_8px] border-[#17203a] bg-[#f3cb42] font-[800] text-[#17203a] shadow-[3px_3px_0_#17203a] enabled:hover:bg-[#f8d75e]',
        'trivia-code':
          'rounded-[7px_3px] border-[#10213d] bg-[#ffda55] font-[820] text-[#10213d] shadow-[3px_3px_0_#10213d] focus-visible:outline-[rgb(18_168_212/32%)] enabled:hover:bg-[#ffe478]',
        'type-code':
          'rounded-[5px_9px_6px_8px] border-[#27183f] bg-[#ffd65a] font-[850] text-[#27183f] shadow-[3px_3px_0_#27183f] focus-visible:outline-[rgb(255_92_87/35%)] enabled:hover:bg-[#ffdf7a]',
        'trivia-primary':
          'rounded-[12px_6px_13px_7px] border-[#10213d] bg-[#ffda55] font-[820] text-[#10213d] shadow-[5px_5px_0_#10213d] focus-visible:outline-[rgb(18_168_212/32%)] enabled:hover:shadow-[7px_7px_0_#10213d]',
        'type-primary':
          'rounded-[8px_14px_9px_13px] border-[#27183f] bg-[#ff5c57] font-[830] text-white shadow-[5px_5px_0_#27183f] focus-visible:outline-[rgb(255_92_87/35%)] enabled:hover:shadow-[7px_7px_0_#27183f]',
        ghost:
          'rounded-lg border-transparent bg-transparent text-[#526079] shadow-[0_2px_0_#d7deea] enabled:hover:bg-white/70',
        destructive:
          'rounded-[11px_9px_12px_10px] border-[#d84d42] bg-[#ff685b] font-[760] text-white shadow-[3px_3px_0_#17203a] enabled:hover:bg-[#f55b50] enabled:hover:shadow-[4px_4px_0_#17203a]',
        'type-destructive':
          'rounded-[9px_13px_10px_12px] border-[#ba393e] bg-[#ff5c57] font-[760] text-white shadow-[3px_3px_0_#27183f] focus-visible:outline-[rgb(255_92_87/30%)] enabled:hover:bg-[#ed4d4f]',
        'destructive-soft':
          'rounded-[9px] border-[#d7544b] bg-[#fff3f1] font-[760] text-[#b73c34] shadow-[0_4px_0_#e5b0ab] enabled:hover:bg-[#ffe9e6]',
        choice:
          'h-auto whitespace-normal rounded-[13px_10px_14px_11px] border-[1.5px] border-[#c6d0df] bg-[#f9fbfd] text-left text-[#38445d] shadow-[0_4px_0_#d7deea] enabled:hover:border-[#9fadc2] data-[selected=true]:border-[#3155d9] data-[selected=true]:bg-[#eef2ff] data-[selected=true]:shadow-[0_4px_0_#3155d9]',
        answer:
          'h-auto whitespace-normal rounded-[14px_7px_15px_8px] border-[1.5px] border-[#bbc9d8] bg-white text-left text-[#31465f] shadow-[0_5px_0_#d6e0e9] focus-visible:outline-[rgb(18_168_212/32%)] enabled:hover:border-[#5e7c98] disabled:opacity-100 data-[selected=true]:border-[#d2a411] data-[selected=true]:bg-[#fff4c7] data-[selected=true]:shadow-[0_5px_0_#d2a411] data-[correct=true]:border-[#16855c] data-[correct=true]:bg-[#e3f8ef] data-[correct=true]:shadow-[0_5px_0_#42b884] data-[incorrect=true]:border-[#ce4942] data-[incorrect=true]:bg-[#fff0ee] data-[incorrect=true]:shadow-[0_5px_0_#e46d64]',
        'game-choice':
          'h-auto flex-col items-stretch justify-start gap-0 whitespace-normal rounded-[14px_9px_15px_10px] border-[1.5px] border-[#c8d2e1] bg-[var(--game-tint)] text-left shadow-[0_4px_0_#d7deea] enabled:hover:border-[var(--game-color)] data-[selected=true]:border-[var(--game-color)] data-[selected=true]:shadow-[0_4px_0_var(--game-color)]',
        decision:
          'h-auto flex-col items-stretch justify-start gap-0 whitespace-normal rounded-[13px_8px_14px_9px] border-[#c5cfdd] bg-white text-left shadow-[0_4px_0_#d7deea] enabled:hover:border-[#8d9cb2] data-[recommended=true]:border-[#35a675] data-[recommended=true]:bg-[#ecf9f2] data-[recommended=true]:shadow-[0_4px_0_#35a675]',
        tab: 'rounded-[7px] border-transparent bg-transparent font-bold text-[#69758b] shadow-[0_2px_0_#cbd4e1] data-[selected=true]:border-[#bdc7d8] data-[selected=true]:bg-white data-[selected=true]:text-[#3155d9] data-[selected=true]:shadow-[0_2px_0_#aebbd0]',
        notice:
          'h-auto whitespace-normal rounded-[10px] border-[#0e1528] bg-[#17203a] text-left text-white shadow-[0_5px_0_#0e1528,0_14px_34px_rgb(23_32_58/25%)]',
        link: 'rounded-sm border-transparent bg-transparent text-[#3155d9] shadow-[0_2px_0_currentColor] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-11 gap-2 px-4',
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1.5 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.75",
        lg: 'h-13 gap-2.25 px-4.5 [&_svg:not([class*="size-"])]:size-4.25',
        xl: 'h-14 gap-2.5 px-6 [&_svg:not([class*="size-"])]:size-4.5',
        icon: 'size-8',
        'icon-xs':
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg',
        'icon-lg': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : 'button';

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
