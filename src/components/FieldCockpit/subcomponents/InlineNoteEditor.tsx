import { Check, X } from 'lucide-react';
import React, { useState } from 'react';

interface InlineNoteEditorProps {
  fieldKey: string;
  initialNote: string;
  onSave: (newNote: string) => void;
  onCancel: () => void;
}

export const InlineNoteEditor: React.FC<InlineNoteEditorProps> = ({
  initialNote,
  onSave,
  onCancel,
}) => {
  const [noteValue, setNoteValue] = useState(initialNote);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSave(noteValue.trim());
    }
  };

  return (
    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <textarea
        rows={3}
        value={noteValue}
        onChange={(e) => setNoteValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Befund / Prüfungshinweis anpassen... (Strg+Enter zum Speichern, Esc zum Abbrechen)"
        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-notar-900 w-full rounded-md border p-2.5 text-sm focus:ring-2 focus:outline-none"
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSave(noteValue.trim())}
          className="bg-notar-500 text-notar-950 hover:bg-notar-600 inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold shadow-2xs sm:text-sm"
        >
          <Check className="h-3.5 w-3.5" />
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground border-border bg-background inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium sm:text-sm"
        >
          <X className="h-3.5 w-3.5" />
          Abbrechen
        </button>
        <span className="text-muted-foreground hidden text-xs sm:inline">
          (Tipp: Strg+Enter zum Speichern, Esc zum Abbrechen)
        </span>
      </div>
    </div>
  );
};
