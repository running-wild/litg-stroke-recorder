# LITG Stroke Recorder

Tool for recording handwriting stroke order. Outputs a PNG with stroke timestamps encoded in the green channel.

## Format spec

Input: PNG with black ink on white background.

Output: PNG with the same dimensions, where:

| Channel | Contents                                                                   |
| ------- | -------------------------------------------------------------------------- |
| R       | Source luminance, preserved exactly. 0 = ink, 255 = background.            |
| G       | Stroke timestamp, normalized to [0, 255]. Meaningful only where R is dark. |
| B       | 0. Reserved for future use.                                                |
| A       | 255.                                                                       |

The shader reads R as the visibility mask (white = transparent, black = opaque) and G as the per-pixel timestamp [0, 1]. A reveal animation drives a `_Progress` parameter; pixels become visible when `G <= _Progress`.

### Encoding rules

- Timestamps are normalized so the first stroke point starts at 0 and the last ends at 1, across the whole handwriting (not per-stroke).
- Strokes are continuous: stroke N starts at the timestamp where stroke N-1 ended.
- Timestamps along a stroke are distributed by **arc length**, not real time. Authoring pace doesn't affect playback pace.
- Pixels touched by multiple strokes use the first stroke's timestamp (first-write-wins).
- Non-ink pixels (white background) have G = 255 by convention. Their value is ignored by the shader because the R-derived mask zeros them out.

### Texture import settings (Unity)

Mark the imported texture as **sRGB: OFF** (linear color space). The green channel carries data, not color, and any sRGB curve will distort timestamps.

Compression: use **uncompressed** (RGBA32) for now. Block compression destroys the green channel's precision.

## Usage

1. Drop a source PNG onto the page.
2. Adjust source opacity and brush radius.
3. Trace the strokes in the order they should be revealed.
4. Lift the pen between strokes (a stroke = one continuous pointer motion).
5. Click "Preview reveal" to see the animation.
6. Click "Export PNG" to download.

## Development

```
npm install
npm run dev
```

## Deployment

GitHub Pages from the `dist/` folder, built via `npm run build`.
