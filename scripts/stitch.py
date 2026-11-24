import sys
from PIL import Image, ImageDraw, ImageFont

def stitch_images(legacy_path, react_path, out_path, title="Comparison"):
    im_legacy = Image.open(legacy_path).convert("RGBA")
    im_react = Image.open(react_path).convert("RGBA")

    w = max(im_legacy.width, im_react.width)
    h = max(im_legacy.height, im_react.height)

    header_h = 60
    total_w = w * 2 + 20
    total_h = h + header_h

    canvas = Image.new("RGBA", (total_w, total_h), (18, 18, 20, 255))
    draw = ImageDraw.Draw(canvas)

    # Paste images
    canvas.paste(im_legacy, (0, header_h))
    canvas.paste(im_react, (w + 20, header_h))

    # Draw divider
    draw.line([(w + 10, 0), (w + 10, total_h)], fill=(50, 50, 55, 255), width=2)

    # Draw labels
    # Use default bitmap font or load basic font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/SFNS.ttf", 24)
    except:
        font = ImageFont.load_default()

    draw.text((20, 18), "LEGACY (Эталон)", fill=(160, 160, 165, 255), font=font)
    draw.text((w + 40, 18), "REACT (Новая версия)", fill=(0, 153, 255, 255), font=font)

    canvas.save(out_path)
    print(f"Saved side-by-side comparison to {out_path}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 stitch.py <legacy.png> <react.png> <out.png> [title]")
        sys.exit(1)
    stitch_images(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "Comparison")
