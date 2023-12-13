# GIF decoder

GIF decoding and rendering with HTML5 canvas

Here is a [live website](https://maz01001.github.io/GIF_decoder/ "Open a live preview of this code") to see this code working, with the [URL parameters](#available-url-parameters "scroll down to the Available URL parameters section") specified below.

- [Type documentation](#type-documentation "scroll down to the Type documentation section")
  - [`GIF` attributes](#gif-attributes "scroll down to the `GIF` attributes section")
  - [`Frame` attributes](#frame-attributes "scroll down to the `Frame` attributes section")
  - [`DisposalMethod` attributes (enum)](#disposalmethod-attributes-enum "scroll down to the `DisposalMethod` attributes (enum) section")
  - [`PlainTextData` attributes](#plaintextdata-attributes "scroll down to the `PlainTextData` attributes section")
  - [`ApplicationExtension` attributes](#applicationextension-attributes "scroll down to the `ApplicationExtension` attributes section")
- [Available URL parameters](#available-url-parameters "scroll down to the Available URL parameters section")

## Type documentation

The `GIF` object constructed has the following attributes.

### `GIF` attributes

<details open><summary>Click to toggle table</summary>

| Attribute               | JSDoc annotation           | Description                                                                                                                                                              |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `width`                 | `number`                   | the width of the image in pixels (logical screen size)                                                                                                                   |
| `height`                | `number`                   | the height of the image in pixels (logical screen size)                                                                                                                  |
| `totalTime`             | `number`                   | the total duration of the gif in milliseconds (all delays added together) <br> will be `Infinity` if there is a frame with the user input delay flag set and no timeout  |
| `colorRes`              | `number`                   | the color depth/resolution in bits per color (in the original) [1-8 bits]                                                                                                |
| `pixelAspectRatio`      | `number`                   | if non zero the pixel aspect ratio will be from 4:1 to 1:4 in 1/64th increments                                                                                          |
| `sortFlag`              | `boolean`                  | if the colors in the global color table are ordered after decreasing importance                                                                                          |
| `globalColorTable`      | `[number,number,number][]` | the global color table for the GIF                                                                                                                                       |
| `backgroundImage`       | `ImageData`                | an image filled with the background color (can be used as a background before the first frame) <br> if the global color table is not available this is transparent black |
| `frames`                | `Frame[]`                  | each frame of the GIF (decoded into single images) <br> [type information further below](#frame-attributes "Scroll to `Frame` definition")                               |
| `comments`              | `[number,string][]`        | comments in the file and on with frame they where found                                                                                                                  |
| `applicationExtensions` | `ApplicationExtension[]`   | all application extensions found <br> [type information further below](#applicationextension-attributes "Scroll to `ApplicationExtension` definition")                   |

</details>

### `Frame` attributes

<details open><summary>Click to toggle table</summary>

| Attribute            | JSDoc annotation           | Description                                                                                                                                                                     |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `left`               | `number`                   | the position of the left edge of this frame, in pixels, within the gif (from the left edge)                                                                                     |
| `top`                | `number`                   | the position of the top edge of this frame, in pixels, within the gif (from the top edge)                                                                                       |
| `width`              | `number`                   | the width of this frame in pixels                                                                                                                                               |
| `height`             | `number`                   | the height of this frame in pixels                                                                                                                                              |
| `disposalMethod`     | `DisposalMethod`           | the disposal method for this frame <br> [type information further below](#disposalmethod-attributes-enum "Scroll to `DisposalMethod` definition")                               |
| `image`              | `ImageData`                | this frames image data                                                                                                                                                          |
| `plainTextData`      | `PlainTextData\|null`      | the text that will be displayed on screen with this frame (if not null) <br> [type information further below](#plaintextdata-attributes "Scroll to `PlainTextData` definition") |
| `userInputDelayFlag` | `boolean`                  | if set waits for user input before rendering the next frame (timeout after delay if that is non-zero)                                                                           |
| `delayTime`          | `number`                   | the delay of this frame in milliseconds                                                                                                                                         |
| `sortFlag`           | `boolean`                  | if the colors in the local color table are ordered after decreasing importance                                                                                                  |
| `localColorTable`    | `[number,number,number][]` | the local color table for this frame                                                                                                                                            |
| `reserved`           | `number`                   | _reserved for future use_ (from packed field in image descriptor block)                                                                                                         |
| `GCreserved`         | `number`                   | _reserved for future use_ (from packed field in graphics control extension block)                                                                                               |

</details>

### `DisposalMethod` attributes (enum)

<details open><summary>Click to toggle table</summary>

| Name                | Internal value <br> (`number`) | Description           | Action                                                  |
| ------------------- | ------------------------------ | --------------------- | ------------------------------------------------------- |
| `Replace`           | `0`                            | unspecified           | replaces entire frame                                   |
| `Combine`           | `1`                            | do not dispose        | combine with previous frame                             |
| `RestoreBackground` | `2`                            | restore to background | combine with background (first frame)                   |
| `RestorePrevious`   | `3`                            | restore to previous   | restore to previous undisposed frame state then combine |
| `UndefinedA`        | `4`                            | undefined             | fallback to `Replace`                                   |
| `UndefinedB`        | `5`                            | undefined             | fallback to `Replace`                                   |
| `UndefinedC`        | `6`                            | undefined             | fallback to `Replace`                                   |
| `UndefinedD`        | `7`                            | undefined             | fallback to `Replace`                                   |

</details>

### `PlainTextData` attributes

<details open><summary>Click to toggle table</summary>

| Attribute         | JSDoc annotation | Description                                                                                |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `left`            | `number`         | the position of the left edge of text grid (in pixels) within the GIF (from the left edge) |
| `top`             | `number`         | the position of the top edge of text grid (in pixels) within the GIF (from the top edge)   |
| `width`           | `number`         | the width of the text grid (in pixels)                                                     |
| `height`          | `number`         | the height of the text grid (in pixels)                                                    |
| `charWidth`       | `number`         | the width (in pixels) of each cell (character) in text grid                                |
| `charHeight`      | `number`         | the height (in pixels) of each cell (character) in text grid                               |
| `foregroundColor` | `number`         | the index into the global color table for the foreground color of the text                 |
| `backgroundColor` | `number`         | the index into the global color table for the background color of the text                 |
| `text`            | `string`         | the text to render on screen                                                               |

</details>

### `ApplicationExtension` attributes

<details open><summary>Click to toggle table</summary>

| Attribute            | JSDoc annotation | Description                                        |
| -------------------- | ---------------- | -------------------------------------------------- |
| `identifier`         | `string`         | 8 character string identifying the application     |
| `authenticationCode` | `string`         | 3 bytes to authenticate the application identifier |
| `data`               | `Uint8Array`     | the (raw) data of this application extension       |

</details>

## Available URL parameters

URL parameters can be in any order (_starting with `?` after the URL then parameters in format `NAME=VALUE` with `&` between each parameter_)

<details open><summary>Click to toggle table</summary>

| Name                  | Possible values                                      | Description                                                                           | Default value                                                                                                         |
| --------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `gifURL`              | HTML image source (URL) <br> (encoded URI component) | the GIF to decode and render                                                          | [this GIF from Wikipedia](https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif "Open Wikipedia GIF file") |
| `alertErrors`         | 0 or 1                                               | Errors while decoding will open an alert pop-up                                       | `1`                                                                                                                   |
| `forceClearLastFrame` | 0 or 1                                               | Forces to clear the screen after the last frame, regardless of what the GIF file says | `1`                                                                                                                   |

</details>
