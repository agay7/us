'use client'

export default function PhotoPicker({
  id,
  files,
  onChange,
}: {
  id: string
  files: FileList | null
  onChange: (files: FileList | null) => void
}) {
  const count = files?.length ?? 0

  return (
    <div className="flex items-center gap-3">
      <label
        htmlFor={id}
        className="cursor-pointer rounded border border-blue-600 px-3 py-2 text-sm text-blue-600"
      >
        📷 Elegir fotos
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => onChange(e.target.files)}
        className="sr-only"
      />
      <span className="text-xs text-gray-500">
        {count > 0
          ? `${count} foto${count === 1 ? '' : 's'} seleccionada${count === 1 ? '' : 's'}`
          : 'Ninguna foto seleccionada'}
      </span>
    </div>
  )
}
