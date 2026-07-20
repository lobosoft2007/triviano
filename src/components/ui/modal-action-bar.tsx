import * as React from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalActionBarProps {
  /** Optional title shown centered between the actions. */
  title?: React.ReactNode;
  /** Left "Voltar" action. */
  onBack: () => void;
  /** Right confirm action. Omit when using a submit button via `saveForm`. */
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  backLabel?: string;
  /** When set, the confirm button becomes a submit button for the given form id. */
  saveForm?: string;
  /** Hide the confirm button entirely (read-only modals). */
  hideSave?: boolean;
  /** Optional secondary save action rendered to the left of the primary save. */
  onSecondarySave?: () => void;
  secondarySaveLabel?: string;
  secondarySaveDisabled?: boolean;
  secondarySaving?: boolean;
  className?: string;
}

/**
 * Sticky top action bar for edit forms and customization modals.
 * Replaces the old floating "X" close icon and the footer save button:
 * - Left: solid, fully opaque "Voltar" button (neutral dark grey, distinct from the green system colour).
 * - Right: solid green "Salvar" confirm button.
 *
 * Designed to sit as the first child inside a DialogContent (`p-6`) — it bleeds
 * to the edges and stays pinned while the body scrolls.
 */
export function ModalActionBar({
  title,
  onBack,
  onSave,
  saving = false,
  saveDisabled = false,
  saveLabel = "Salvar",
  backLabel = "Voltar",
  saveForm,
  hideSave = false,
  onSecondarySave,
  secondarySaveLabel = "Salvar",
  secondarySaveDisabled = false,
  secondarySaving = false,
  className,
}: ModalActionBarProps) {
  const showSave = !hideSave && (onSave || saveForm);
  const showSecondary = !hideSave && !!onSecondarySave;

  return (
    <div
      className={cn(
        "sticky top-0 z-20 -mx-6 -mt-6 mb-1 flex items-center gap-2 border-b border-border bg-background px-4 py-3",
        className,
      )}
    >
      <Button
        type="button"
        variant="back"
        size="default"
        onClick={onBack}
        className="gap-1.5 font-semibold"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </Button>

      {title ? (
        <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold">
          {title}
        </span>
      ) : (
        <span className="flex-1" />
      )}

      {showSecondary ? (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={onSecondarySave}
          disabled={secondarySaving || secondarySaveDisabled || saving}
          className="gap-1.5 font-semibold"
        >
          {secondarySaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {secondarySaveLabel}
        </Button>
      ) : null}

      {showSave ? (
        <Button
          type={saveForm ? "submit" : "button"}
          form={saveForm}
          variant="success"
          size="default"
          onClick={onSave}
          disabled={saving || saveDisabled || secondarySaving}
          className="gap-1.5 font-semibold"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {saveLabel}
        </Button>
      ) : (
        <span className="w-[76px]" />
      )}
    </div>
  );
}

