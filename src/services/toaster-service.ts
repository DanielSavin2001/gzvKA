import {toasts} from "svelte-toasts";
import type {Placement, Theme, ToastType} from "svelte-toasts/types/common";

const DEFAULT_DURATION = 5000;
const DEFAULT_THEME = 'dark';
const DEFAULT_PLACEMENT = 'bottom-right';
const DEFAULT_SHOW_PROGRESS = true

export const showSuccessToast = (
    title: string,
    description: string,
    duration: number | null = null,
    placement: Placement | null = null,
    theme: Theme | null = null,
    showProgress: boolean | null = null,
    onClick: void | null = null,
    onRemove: void | null = null,
) => {
    showToast(title,
        description,
        "success",
        duration,
        placement,
        theme,
        showProgress,
        onClick,
        onRemove,
    )
}

export const showInfoToast = (
    title: string,
    description: string,
    duration: number | null = null,
    placement: Placement | null = null,
    theme: Theme | null = null,
    showProgress: boolean | null = null,
    onClick: void | null = null,
    onRemove: void | null = null,
) => {
    showToast(title, description, "info",
        duration,
        placement,
        theme,
        showProgress,
        onClick,
        onRemove,
    )
}

export const showErrorToast = (
    title: string,
    description: string,
    duration: number | null = null,
    placement: Placement | null = null,
    theme: Theme | null = null,
    showProgress: boolean | null = null,
    onClick: void | null = null,
    onRemove: void | null = null,
) => {
    showToast(title, description, "error",
        duration,
        placement,
        theme,
        showProgress,
        onClick,
        onRemove,
    )
}

export const showWarningToast = (
    title: string,
    description: string,
    duration: number | null = null,
    placement: Placement | null = null,
    theme: Theme | null = null,
    showProgress: boolean | null = null,
    onClick: void | null = null,
    onRemove: void | null = null,
) => {
    showToast(title, description, "warning",
        duration,
        placement,
        theme,
        showProgress,
        onClick,
        onRemove,
    )
}

const showToast = (
    title: string,
    description: string,
    type: ToastType,
    duration: number | null,
    placement: Placement | null,
    theme: Theme | null,
    showProgress: boolean | null,
    onClick: void | null,
    onRemove: void | null,
) => {
    toasts.add({
        title: title,
        description: description,
        duration: duration ? duration : DEFAULT_DURATION,
        placement: placement ? placement : DEFAULT_PLACEMENT,
        theme: theme ? theme : DEFAULT_THEME,
        type: type,
        showProgress: showProgress ? showProgress : DEFAULT_SHOW_PROGRESS,
        onClick: () => onClick,
        onRemove: () => onRemove,
    })
};