"use client";

import { deleteHeroSlideAction } from "./actions";

export function DeleteSlideButton({ id }: { id: number }) {
  return (
    <form
      action={deleteHeroSlideAction}
      onSubmit={(e) => {
        if (!confirm("Delete this slide?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-rose-700 hover:underline">
        Delete
      </button>
    </form>
  );
}
