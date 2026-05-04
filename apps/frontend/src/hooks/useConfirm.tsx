import { useState, useCallback, useRef } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/src/components/ui/alert-dialog";

export function useConfirm() {
  const [state, setState] = useState({ open: false, message: "" });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((message: string) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, message });
    });
  }, []);

  function handleConfirm() {
    setState({ open: false, message: "" });
    resolverRef.current?.(true);
    resolverRef.current = null;
  }

  function handleCancel() {
    setState({ open: false, message: "" });
    resolverRef.current?.(false);
    resolverRef.current = null;
  }

  function ConfirmDialog() {
    return (
      <AlertDialog
        open={state.open}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
        <AlertDialogContent className="">
          <AlertDialogHeader className="">
            <AlertDialogTitle>确认</AlertDialogTitle>
            <AlertDialogDescription>{state.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="">
            <AlertDialogCancel onClick={handleCancel}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return { confirm, ConfirmDialog };
}
