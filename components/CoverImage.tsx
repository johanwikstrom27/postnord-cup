type Props = {
  src?: string | null;
  alt: string;
};

export default function CoverImage({ src, alt }: Props) {
  return (
    <div
      className="relative w-full overflow-hidden bg-black"
      style={{ height: 160 }} // ← justera ENDAST här om du vill ändra storlek
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: "linear-gradient(135deg, #0b1c3d, #05070f)",
          }}
        />
      )}
    </div>
  );
}