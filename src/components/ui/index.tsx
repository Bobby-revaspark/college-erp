import {forwardRef,type ButtonHTMLAttributes,type HTMLAttributes,type ReactNode} from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/utils';

// Source-owned shadcn Button pattern, themed with the Campus design system.
export const buttonVariants=cva('btn',{
 variants:{
  variant:{default:'',secondary:'secondary',outline:'secondary',ghost:'ghost'},
  size:{default:'',sm:'btn-sm',lg:'btn-lg',icon:'btn-icon'},
 },
 defaultVariants:{variant:'default',size:'default'},
});
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>,VariantProps<typeof buttonVariants>{asChild?:boolean;secondary?:boolean}
export const Button=forwardRef<HTMLButtonElement,ButtonProps>(({children,secondary=false,variant,size,asChild=false,type='button',className,...props},ref)=>{
 const Comp=asChild?Slot:'button';
 return <Comp ref={ref} type={type} className={cn(buttonVariants({variant:secondary?'secondary':variant,size,className}))} {...props}>{children}</Comp>;
});
Button.displayName='Button';
export const badgeVariants=cva('badge',{variants:{tone:{green:'green',amber:'amber',red:'red',neutral:'neutral'}},defaultVariants:{tone:'green'}});
export function Badge({children,tone='green',className,...props}:HTMLAttributes<HTMLSpanElement>&{children:ReactNode;tone?:string}){return <span className={cn(badgeVariants({tone:tone as 'green'|'amber'|'red'|'neutral'}),className)} {...props}>{children}</span>}
export const Card=forwardRef<HTMLElement,HTMLAttributes<HTMLElement>>(({className,...props},ref)=><section ref={ref} className={cn('card',className)} {...props}/>);
Card.displayName='Card';
