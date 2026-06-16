import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useUpdateNote, type Note } from './api';

export function NoteEditor({ projectId, note }: { projectId: string; note: Note }) {
  const update = useUpdateNote(projectId);
  const [title, setTitle] = useState(note.title);
  const [saved, setSaved] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const initialContent = useMemo(
    () => (note.content as JSONContent) ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    [note.id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const editor = useEditor(
    {
      extensions: [StarterKit],
      content: initialContent,
      onUpdate: () => scheduleSave(),
    },
    [note.id],
  );

  useEffect(() => {
    setTitle(note.title);
  }, [note.id, note.title]);

  function scheduleSave() {
    setSaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      update.mutate(
        { id: note.id, title, content: editor?.getJSON() as unknown },
        { onSuccess: () => setSaved(true) },
      );
    }, 800);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
          className="flex-1 bg-transparent text-xl font-semibold outline-none"
        />
        <span className="text-xs text-muted">{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <div className="text-xs text-muted">
        {note.createdBy?.name && `by ${note.createdBy.name} · `}
        updated {new Date(note.updatedAt).toLocaleString()}
      </div>
      <div className="prose mt-3 max-w-none flex-1 overflow-y-auto rounded-card border border-border p-3 text-sm [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror]:outline-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
