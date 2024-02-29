# GIF decoder

GIF decoding and rendering with HTML5 canvas

Here is a link to the [live website](https://maz01001.github.io/GIF_decoder/ "Open GIF decoder/player online") for the GIF decoder/player,
with [URL parameters](#available-url-parameters "scroll down to the Available URL parameters section") as specified below.

Also, see the [specs for GIF89a](https://www.w3.org/Graphics/GIF/spec-gif89a.txt "Open W3 GIF89a specs (1990)") and [`What's In A GIF: GIF Explorer`](https://www.matthewflickinger.com/lab/whatsinagif/gif_explorer.asp "Open What's In A GIF - GIF Explorer by Matthew (2005)") by [@MrFlick](https://github.com/MrFlick "MrFlick on GitHub") for more technical details.

- [Available URL parameters](#available-url-parameters "scroll down to the Available URL parameters section")
  - [Edge cases](#edge-cases "scroll down to Edge cases section")
- [Exported constants](#exported-constants "scroll down to the Exported constants section")
  - [Export `DisposalMethod` enum](#export-disposalmethod-enum "scroll down to the Export `DisposalMethod` enum section")
  - [Export `decodeGIF` function](#export-decodegif-function "scroll down to the Export `decodeGIF` function section")
  - [Export `getGIFLoopAmount` function](#export-getgifloopamount-function "scroll down to the Export `getGIFLoopAmount` function section")
- [Type documentation](#type-documentation "scroll down to the Type documentation section")
  - [`GIF` attributes](#gif-attributes "scroll down to the `GIF` attributes section")
  - [`Frame` attributes](#frame-attributes "scroll down to the `Frame` attributes section")
  - [`DisposalMethod` attributes (enum)](#disposalmethod-attributes-enum "scroll down to the `DisposalMethod` attributes (enum) section")
  - [`PlainTextData` attributes](#plaintextdata-attributes "scroll down to the `PlainTextData` attributes section")
  - [`ApplicationExtension` attributes](#applicationextension-attributes "scroll down to the `ApplicationExtension` attributes section")

## Available URL parameters

URL parameters can be in any order, starting with `?` after the URL and then parameters in the format `NAME=VALUE` with `&` between each parameter.

>
> [!NOTE]
>
> Values must be [encoded URI components](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent "MDN: JS encodeURIComponent() function").
>
> Parameters with values `0`/`1` can omit the `=VALUE` for it to be treated as `1`.
>

For example `?url=https%3A%2F%2Fexample.com%2Fexample.gif&gifInfo=0&frameInfo` translates to:

| Name        | Decoded value                     |
| ----------- | --------------------------------- |
| `url`       | `https://example.com/example.gif` |
| `gifInfo`   | `0` (collapsed)                   |
| `frameInfo` | `1` (expanded)                    |

<details open><summary>Click to toggle table</summary>

| Name               | Possible values                                                                  | Description                                                                                                      | Default value                                                                                                                                                                                                                                             |
| ------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`              | a GIF file URL                                                                   | GIF URL to load                                                                                                  | [This public domain GIF from Wikimedia<br><img height="68.5" alt="Wax_fire.gif" src="https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif">](https://commons.wikimedia.org/wiki/File:Wax_fire.gif "Open file info page on Wikimedia Commons") |
| `gifInfo`          | `0` collapsed / `1` expanded                                                     | If the _GIF info_ section should be expanded                                                                     | `1` (expanded)                                                                                                                                                                                                                                            |
| `globalColorTable` | `0` collapsed / `1` expanded                                                     | If the _Global color table_ section should be expanded                                                           | `1` (expanded)                                                                                                                                                                                                                                            |
| `appExtList`       | `0` collapsed / `1` expanded                                                     | If the _Application-Extensions_ section should be expanded                                                       | `1` (expanded)                                                                                                                                                                                                                                            |
| `commentsList`     | `0` collapsed / `1` expanded                                                     | If the _Comments_ section should be expanded                                                                     | `0` (collapsed)                                                                                                                                                                                                                                           |
| `unExtList`        | `0` collapsed / `1` expanded                                                     | If the _Unknown extensions_ section should be expanded                                                           | `0` (collapsed)                                                                                                                                                                                                                                           |
| `frameView`        | `0` collapsed / `1` expanded                                                     | If the _frame canvas_ section should be expanded                                                                 | `0` (collapsed)                                                                                                                                                                                                                                           |
| `frameInfo`        | `0` collapsed / `1` expanded                                                     | If the _Frame info_ section should be expanded                                                                   | `0` (collapsed)                                                                                                                                                                                                                                           |
| `localColorTable`  | `0` collapsed / `1` expanded                                                     | If the _local color table_ section should be expanded                                                            | `1` (expanded)                                                                                                                                                                                                                                            |
| `frameText`        | `0` collapsed / `1` expanded                                                     | If the (Frame) _Text_ section should be expanded                                                                 | `0` (collapsed)                                                                                                                                                                                                                                           |
| `import`           | `0` closed / `1` open                                                            | If the import menu should be opened                                                                              | `0` (closed)                                                                                                                                                                                                                                              |
| `play`             | float between `-100` and `100`<br>`<0` reversed / `>0` (or empty) forwards       | If the GIF should be playing, how fast, and in what direction                                                    | `0` (paused)                                                                                                                                                                                                                                              |
| `f`                | zero-based frame index (positive integer)<br>_if out of bounds uses first frame_ | Start at a specific frame                                                                                        | `0` (first frame)                                                                                                                                                                                                                                         |
| `userLock`         | `0` OFF / `1` ON                                                                 | If the _user input lock_ button should be toggled on                                                             | `0` (OFF)                                                                                                                                                                                                                                                 |
| `gifFull`          | `0` OFF / `1` ON                                                                 | If the GIF _full window_ button should be toggled on                                                             | `0` (OFF)                                                                                                                                                                                                                                                 |
| `gifReal`          | `0` OFF / `1` ON                                                                 | If the GIF _fit window_ button should be toggled on                                                              | `0` (OFF)                                                                                                                                                                                                                                                 |
| `gifSmooth`        | `0` OFF / `1` ON                                                                 | If the GIF _img smoothing_ should be toggled on                                                                  | `0` (OFF)                                                                                                                                                                                                                                                 |
| `frameFull`        | `0` OFF / `1` ON                                                                 | If the frame _full window_ button should be toggled on                                                           | `0` (OFF)                                                                                                                                                                                                                                                 |
| `frameReal`        | `0` OFF / `1` ON                                                                 | If the frame _fit window_ button should be toggled on                                                            | `0` (OFF)                                                                                                                                                                                                                                                 |
| `frameSmooth`      | `0` OFF / `1` ON                                                                 | If the frame _img smoothing_ button should be toggled on                                                         | `0` (OFF)                                                                                                                                                                                                                                                 |
| `pos`              | `[integer,integer]`                                                              | The position/offset of the GIF/frame rendering canvas ([left,top] safe integers)                                 | `[0,0]` (origin)                                                                                                                                                                                                                                          |
| `zoom`             | integer                                                                          | The starting zoom of the GIF/frame rendering canvas (safe integer)<br>capped to (+-) half of GIF width (floored) | `0` (no zoom)                                                                                                                                                                                                                                             |

</details>

### Edge cases

- If, during decoding, an error occurs, it will show the import menu and display the error without further decoding/rendering (ignore all parameters, except for collapsible areas)
- If `import` is given only allow `url` and collapsable areas (ignore all other parameters)
  - When the import menu is open, the GIF is not yet decoded (only a preview is shown)
- If `gifReal` and `frameReal` are both `0` (OFF) ignore `pos` and `zoom`
- If `gifFull` is `1` (ON) ignore `frameFull`
- If `frameFull` is `1` (ON) ignore `frameView`
- If `frameView` is `0` (collapsed) ignore `frameReal` and `frameSmooth`
- If `pos` and `zoom` are given, apply `pos` before `zoom`
- If, during decoding, an error occurs, it will show the import menu and display the error without further decoding/rendering

## Exported constants

Exported constants in the [`GIFdecodeModule.js`](./GIFdecodeModule.js "open file GIFdecodeModule.js") file.

- [Export `DisposalMethod` enum](#export-disposalmethod-enum "scroll down to the Export `DisposalMethod` enum section")
- [Export `decodeGIF` function](#export-decodegif-function "scroll down to the Export `decodeGIF` function section")
- [Export `getGIFLoopAmount` function](#export-getgifloopamount-function "scroll down to the Export `getGIFLoopAmount` function section")

### Export `DisposalMethod` enum

See description/type information [further below](#disposalmethod-attributes-enum "Scroll to `DisposalMethod` definition").

### Export `decodeGIF` function

Decodes a GIF into its components for rendering on a canvas.

<details><summary><code>async decodeGIF(gifURL, avgAlpha, progressCallback, fetchProgressCallback)</code></summary>

function parameters (in order)

1. `gifURL` (`string`) The URL of a GIF file.
2. `avgAlpha` (optional `boolean`) If this is `true` then, when encountering a transparent pixel, it uses the average value of the pixels RGB channels to calculate the alpha channels value, otherwise alpha channel is either 0 or 1. Default `false`.
3. `progressCallback` (optional `function`) Optional callback for showing progress of decoding process (when GIF is interlaced calls after each pass (4x on the same frame)).
   If asynchronous, it waits for it to resolve.

   ```typescript
   function(
       percentageRead: number,     // decimal from 0 to 1
       frameIndex: number,         // zero-based frame index
       frame: ImageData,           // current decoded frame (image)
       framePos: [number, number], // pos from left/top of GIF area
       gifSize: [number, number]   // GIF area width/height
   ): any
   ```

4. `fetchProgressCallback` (optional `function`) Optional callback for showing progress of fetching the image data (in bytes).

   ```typescript
   function(
       loaded: number,      // amount of bytes loaded
       total: number | null // total amount of bytes to load (or null if not available)
   ): any
   ```

Returns ([`GIF`](#gif-attributes "scroll down to the `GIF` attributes section")) a promise of the [`GIF`](#gif-attributes "scroll down to the `GIF` attributes section") with each frame decoded separately.
The promise may reject for one the following reasons:

- `fetch error` when trying to fetch the GIF from {@linkcode gifURL} (probably blocked by [CORS security options](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS "MDN: Cross-Origin Resource Sharing"))
- `fetch aborted` when trying to fetch the GIF from {@linkcode gifURL}
- `loading error [CODE]` when URL yields a status code that's not between 200 and 299 (inclusive)
- `not a supported GIF file` when the GIF version is not `GIF89a`
- `error while parsing frame [INDEX] "ERROR"` while decoding GIF - one of the following
  - `GIF frame size is to large`
  - `plain text extension without global color table`
  - `undefined block found`

Throws (`TypeError`) for one of the following (in order)

1. `gifURL` is not a string
2. `avgAlpha` is given (not `null` or `undefined`) but not a boolean
3. `progressCallback` is given (not `null` or `undefined`) but not a function
4. `fetchProgressCallback` is given (not `null` or `undefined`) but not a function.

</details>

### Export `getGIFLoopAmount` function

Extract the animation loop amount from a [`GIF`](#gif-attributes "scroll down to the `GIF` attributes section").

>
> [!NOTE]\
> Generally, for proper looping support, the `NETSCAPE2.0` extension must appear immediately after the global color table of the logical screen descriptor (at the beginning of the GIF file).
> Still, here, it doesn't matter where it was found.
>

<details><summary><code>getGIFLoopAmount(gif)</code></summary>

function parameters (in order)

1. `gif` ([`GIF`](#gif-attributes "scroll down to the `GIF` attributes section")) A parsed GIF object.

Returns (`number`) the loop amount of `gif` as 16bit number (0 to 65'535 or `Infinity`).

</details>

## Type documentation

The `GIF` object constructed has the following attributes.

### `GIF` attributes

<details open><summary>Click to toggle table</summary>

| Attribute               | JSDoc annotation           | Description                                                                                                                                                                       |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`                 | `number`                   | the width of the image in pixels (logical screen size)                                                                                                                            |
| `height`                | `number`                   | the height of the image in pixels (logical screen size)                                                                                                                           |
| `totalTime`             | `number`                   | the (maximum) total duration of the gif in milliseconds (all delays added together) <br> will be `Infinity` if there is a frame with the user input delay flag set and no timeout |
| `colorRes`              | `number`                   | the color depth/resolution in bits per color (in the original) [1-8 bits]                                                                                                         |
| `pixelAspectRatio`      | `number`                   | if non zero the pixel aspect ratio will be from 4:1 to 1:4 in 1/64th increments                                                                                                   |
| `sortFlag`              | `boolean`                  | if the colors in the global color table are ordered after decreasing importance                                                                                                   |
| `globalColorTable`      | `[number,number,number][]` | the global color table for the GIF                                                                                                                                                |
| `backgroundColorIndex`  | `number\|null`             | index of the background color into the global color table (if the global color table is not available it's `null`) <br> can be used as a background before the first frame        |
| `frames`                | `Frame[]`                  | each frame of the GIF (decoded into single images) <br> type information [further below](#frame-attributes "Scroll to `Frame` definition")                                        |
| `comments`              | `[string,string][]`        | comments in the file and were they where found (`[<area found>,<comment>]`)                                                                                                       |
| `applicationExtensions` | `ApplicationExtension[]`   | all application extensions found <br> type information [further below](#applicationextension-attributes "Scroll to `ApplicationExtension` definition")                            |
| `unknownExtensions`     | `[number,Uint8Array][]`    | all unknown extensions found (`[<identifier>,<raw bytes>]`)                                                                                                                       |

</details>

### `Frame` attributes

<details open><summary>Click to toggle table</summary>

| Attribute               | JSDoc annotation           | Description                                                                                                                                                                                   |
| ----------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `left`                  | `number`                   | the position of the left edge of this frame, in pixels, within the gif (from the left edge)                                                                                                   |
| `top`                   | `number`                   | the position of the top edge of this frame, in pixels, within the gif (from the top edge)                                                                                                     |
| `width`                 | `number`                   | the width of this frame in pixels                                                                                                                                                             |
| `height`                | `number`                   | the height of this frame in pixels                                                                                                                                                            |
| `disposalMethod`        | `DisposalMethod`           | the disposal method for this frame <br> type information [further below](#disposalmethod-attributes-enum "Scroll to `DisposalMethod` definition")                                             |
| `transparentColorIndex` | `number\|null`             | the transparency index into the local or global color table (`null` if not encountered)                                                                                                       |
| `image`                 | `ImageData`                | this frames image data                                                                                                                                                                        |
| `plainTextData`         | `PlainTextData\|null`      | the text that will be displayed on screen with this frame (`null` if not encountered) <br> type information [further below](#plaintextdata-attributes "Scroll to `PlainTextData` definition") |
| `userInputDelayFlag`    | `boolean`                  | if set waits for user input before rendering the next frame (timeout after delay if that is non-zero)                                                                                         |
| `delayTime`             | `number`                   | the delay of this frame in milliseconds (`0` is undefined (_wait for user input or skip frame_) - `10`ms precision)                                                                           |
| `sortFlag`              | `boolean`                  | if the colors in the local color table are ordered after decreasing importance                                                                                                                |
| `localColorTable`       | `[number,number,number][]` | the local color table for this frame                                                                                                                                                          |
| `reserved`              | `number`                   | _reserved for future use_ 2bits (from packed field in image descriptor block)                                                                                                                 |
| `GCreserved`            | `number`                   | _reserved for future use_ 3bits (from packed field in graphics control extension block)                                                                                                       |

</details>

### `DisposalMethod` attributes (enum)

<details open><summary>Click to toggle table</summary>

| Name                     | Internal value <br> (`number`) | Description                 | Action                                                                                                          |
| ------------------------ | ------------------------------ | --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Unspecified`            | `0`                            | unspecified                 | do nothing (default to `DoNotDispose`)                                                                          |
| `DoNotDispose`           | `1`                            | do not dispose              | keep image / combine with next frame                                                                            |
| `RestoreBackgroundColor` | `2`                            | restore to background color | opaque frame pixels get filled with background color or cleared (when it's the same as `transparentColorIndex`) |
| `RestorePrevious`        | `3`                            | restore to previous         | dispose frame data after rendering (revealing what was there before)                                            |
| `UndefinedA`             | `4`                            | undefined                   | fallback to `Unspecified`                                                                                       |
| `UndefinedB`             | `5`                            | undefined                   | fallback to `Unspecified`                                                                                       |
| `UndefinedC`             | `6`                            | undefined                   | fallback to `Unspecified`                                                                                       |
| `UndefinedD`             | `7`                            | undefined                   | fallback to `Unspecified`                                                                                       |

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
