"use client";

import { deleteNewsFeatureAction } from "./news-actions";

export function DeleteNewsFeatureButton({ id }: { id: number }) {
  return (
    <form
      action={deleteNewsFeatureAction}
      onSubmit={(e) => {
        if (!confirm("Delete this news feature?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-rose-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
