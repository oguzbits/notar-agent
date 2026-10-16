import { MessageSquareText, Plus } from 'lucide-react';
import React from 'react';
import { cn } from '@/lib/utils';

const NOTE_SEPARATOR = '\n\n';

interface UploadNotesProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  disabled: boolean;
}

interface NoteFieldProps {
  index: number;
  text: string;
  removable: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onRemove: () => void;
}

const NoteField: React.FC<NoteFieldProps> = ({
  index,
  text,
  removable,
  disabled,
  onChange,
  onRemove,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <label className="text-muted-foreground text-sm font-medium">{`Notiz #${index + 1}`}</label>
      {removable && !disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive cursor-pointer text-sm transition-colors"
        >
          Entfernen
        </button>
      )}
    </div>
    <textarea
      value={text}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Ergänzende Sachverhaltsangaben, aktuelle Absprachen oder interne Bearbeitungshinweise für die Zuarbeit..."
      rows={3}
      className={cn(
        'border-border bg-muted/30 focus:bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full resize-y rounded-lg border p-3 text-base focus:ring-1 focus:outline-none',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    />
  </div>
);

/** Feste Notiz-Sektion für Sachverhalt & Telefonate (nicht einklappbar). */
export const UploadNotes: React.FC<UploadNotesProps> = ({ notes, onNotesChange, disabled }) => {
  const noteList = notes ? notes.split(NOTE_SEPARATOR) : [''];
  const emit = (list: string[]) => onNotesChange(list.join(NOTE_SEPARATOR));

  return (
    <div className="border-border space-y-3 border-t pt-4">
      <div className="flex items-center gap-2">
        <MessageSquareText className="text-notar-900 h-4 w-4" />
        <h2 className="text-foreground text-base font-semibold">
          Ergänzende Hinweise &amp; interne Notizen zur Akte (optional)
        </h2>
        {notes.trim().length > 0 && <span className="bg-notar-500 h-2 w-2 rounded-full" />}
      </div>

      <div className="space-y-3">
        <div className="space-y-2.5">
          {noteList.map((text, idx) => (
            <NoteField
              key={idx}
              index={idx}
              text={text}
              removable={noteList.length > 1}
              disabled={disabled}
              onChange={(value) => emit(noteList.map((t, i) => (i === idx ? value : t)))}
              onRemove={() => emit(noteList.filter((_, i) => i !== idx))}
            />
          ))}

          {!disabled && (
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => emit([...noteList, ''])}
                className="border-border hover:bg-muted text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-base font-medium transition-colors"
              >
                <Plus className="text-notar-900 h-4 w-4" />
                <span>Weiteres Notizfeld hinzufügen</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-muted-foreground text-base leading-relaxed">
          Diese Notizen fließen direkt in die Prüfung ein und ergänzen bzw. aktualisieren die
          Angaben aus den hochgeladenen Dokumenten.
        </p>
      </div>
    </div>
  );
};
