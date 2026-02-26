import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export type WithElementRef<T> = T & {
	ref?: HTMLElement | null;
};

export type WithoutChild<T> = T;
export type WithoutChildren<T> = T;
