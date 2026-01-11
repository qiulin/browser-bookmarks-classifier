# Extension Icons

This directory should contain PNG icons for the Chrome extension.

## Required Icons

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

## Creating Icons

You can use the provided `icon.svg` as a base to generate the PNG files.

### Using ImageMagick:

```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Using Online Tools:

1. Open `icon.svg` in a browser
2. Use a screenshot tool to capture at different sizes
3. Save as PNG

### Alternative: Use a design tool

- Open `icon.svg` in Figma, Sketch, or Adobe Illustrator
- Export at 16px, 48px, and 128px
