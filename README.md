# GIF decoder

GIF decoding and rendering with HTML5 canvas

- [Type documentation](#type-documentation)
  - [`GIF` attributes](#gif-attributes)
  - [`Frame` attributes](#frame-attributes)
  - [`DisposalMethod` attributes (enum)](#disposalmethod-attributes-enum)
  - [`PlainTextData` attributes](#plaintextdata-attributes)
  - [`ApplicationExtension` attributes](#applicationextension-attributes)
- [Available URL parameters](#available-url-parameters)

## Type documentation

The `GIF` object constructed has the following attributes.

### `GIF` attributes

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Attribute</th><th>JSDoc annotation</th><th>Description</th></tr>
    <tr><td><code>width</code></td><td><code>number</code></td><td>the width of the image in pixels (logical screen size)</td></tr>
    <tr><td><code>height</code></td><td><code>number</code></td><td>the height of the image in pixels (logical screen size)</td></tr>
    <tr><td><code>totalTime</code></td><td><code>number</code></td><td>the total duration of the gif in milliseconds (all delays added together) - will be <code>Infinity</code> if there is a frame with the user input delay flag set and no timeout</td></tr>
    <tr><td><code>colorRes</code></td><td><code>number</code></td><td>the color depth/resolution in bits per color (in the original) [1-8 bits]</td></tr>
    <tr><td><code>pixelAspectRatio</code></td><td><code>number</code></td><td>if non zero the pixel aspect ratio will be from 4:1 to 1:4 in 1/64th increments</td></tr>
    <tr><td><code>sortFlag</code></td><td><code>boolean</code></td><td>if the colors in the global color table are ordered after decreasing importance</td></tr>
    <tr><td><code>globalColorTable</code></td><td><code>[number,number,number][]</code></td><td>the global color table for the GIF</td></tr>
    <tr><td><code>backgroundImage</code></td><td><code>ImageData</code></td><td>an image filled with the background color (can be used as a background before the first frame) - if the global color table is not available this is transparent black</td></tr>
    <tr><td><code>frames</code></td><td><code>Frame[]</code></td><td>each frame of the GIF (decoded into single images) - <a href="#frame-attributes">type information further below</a></td></tr>
    <tr><td><code>comments</code></td><td><code>[number,string][]</code></td><td>comments in the file and on with frame they where found</td></tr>
    <tr><td><code>applicationExtensions</code></td><td><code>ApplicationExtension[]</code></td><td>all application extensions found - <a href="#applicationextension-attributes">type information further below</a></td></tr>
  </table>
</details>

### `Frame` attributes

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Attribute</th><th>JSDoc annotation</th><th>Description</th></tr>
    <tr><td><code>left</code></td><td><code>number</code></td><td>the position of the left edge of this frame, in pixels, within the gif (from the left edge)</td></tr>
    <tr><td><code>top</code></td><td><code>number</code></td><td>the position of the top edge of this frame, in pixels, within the gif (from the top edge)</td></tr>
    <tr><td><code>width</code></td><td><code>number</code></td><td>the width of this frame in pixels</td></tr>
    <tr><td><code>height</code></td><td><code>number</code></td><td>the height of this frame in pixels</td></tr>
    <tr><td><code>disposalMethod</code></td><td><code>DisposalMethod</code></td><td>the disposal method for this frame - <a href="#disposalmethod-attributes-enum">type information further below</a></td></tr>
    <tr><td><code>image</code></td><td><code>ImageData</code></td><td>this frames image data</td></tr>
    <tr><td><code>plainTextData</code></td><td><code>PlainTextData|null</code></td><td>the text that will be displayed on screen with this frame (if not null) - <a href="#plaintextdata-attributes">type information further below</a></td></tr>
    <tr><td><code>userInputDelayFlag</code></td><td><code>boolean</code></td><td>if set waits for user input before rendering the next frame (timeout after delay if that is non-zero)</td></tr>
    <tr><td><code>delayTime</code></td><td><code>number</code></td><td>the delay of this frame in milliseconds</td></tr>
    <tr><td><code>sortFlag</code></td><td><code>boolean</code></td><td>if the colors in the local color table are ordered after decreasing importance</td></tr>
    <tr><td><code>localColorTable</code></td><td><code>[number,number,number][]</code></td><td>the local color table for this frame</td></tr>
    <tr><td><code>reserved</code></td><td><code>number</code></td><td><i>reserved for future use</i> (from packed field in image descriptor block)</td></tr>
    <tr><td><code>GCreserved</code></td><td><code>number</code></td><td><i>reserved for future use</i> (from packed field in graphics control extension block)</td></tr>
  </table>
</details>

### `DisposalMethod` attributes (enum)

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Name</th><th>Internal value (<code>number</code>)</th><th>Description</th><th>Action</th></tr>
    <tr><td><code>Replace</code></td><td><code>0</code></td><td>unspecified</td><td>replaces entire frame</td></tr>
    <tr><td><code>Combine</code></td><td><code>1</code></td><td>do not dispose</td><td>combine with previous frame</td></tr>
    <tr><td><code>RestoreBackground</code></td><td><code>2</code></td><td>restore to background</td><td>combine with background (first frame)</td></tr>
    <tr><td><code>RestorePrevious</code></td><td><code>3</code></td><td>restore to previous</td><td>restore to previous undisposed frame state then combine</td></tr>
    <tr><td><code>UndefinedA</code></td><td><code>4</code></td><td>undefined</td><td>fallback to <code>Replace</code></td></tr>
    <tr><td><code>UndefinedB</code></td><td><code>5</code></td><td>undefined</td><td>fallback to <code>Replace</code></td></tr>
    <tr><td><code>UndefinedC</code></td><td><code>6</code></td><td>undefined</td><td>fallback to <code>Replace</code></td></tr>
    <tr><td><code>UndefinedD</code></td><td><code>7</code></td><td>undefined</td><td>fallback to <code>Replace</code></td></tr>
  </table>
</details>

### `PlainTextData` attributes

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Attribute</th><th>JSDoc annotation</th><th>Description</th></tr>
    <tr><td><code>left</code></td><td><code>number</code></td><td>the position of the left edge of text grid (in pixels) within the GIF (from the left edge)</td></tr>
    <tr><td><code>top</code></td><td><code>number</code></td><td>the position of the top edge of text grid (in pixels) within the GIF (from the top edge)</td></tr>
    <tr><td><code>width</code></td><td><code>number</code></td><td>the width of the text grid (in pixels)</td></tr>
    <tr><td><code>height</code></td><td><code>number</code></td><td>the height of the text grid (in pixels)</td></tr>
    <tr><td><code>charWidth</code></td><td><code>number</code></td><td>the width (in pixels) of each cell (character) in text grid</td></tr>
    <tr><td><code>charHeight</code></td><td><code>number</code></td><td>the height (in pixels) of each cell (character) in text grid</td></tr>
    <tr><td><code>foregroundColor</code></td><td><code>number</code></td><td>the index into the global color table for the foreground color of the text</td></tr>
    <tr><td><code>backgroundColor</code></td><td><code>number</code></td><td>the index into the global color table for the background color of the text</td></tr>
    <tr><td><code>text</code></td><td><code>string</code></td><td>the text to render on screen</td></tr>
  </table>
</details>

### `ApplicationExtension` attributes

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Attribute</th><th>JSDoc annotation</th><th>Description</th></tr>
    <tr><td><code>identifier</code></td><td><code>string</code></td><td>8 character string identifying the application</td></tr>
    <tr><td><code>authenticationCode</code></td><td><code>string</code></td><td>3 bytes to authenticate the application identifier</td></tr>
    <tr><td><code>data</code></td><td><code>Uint8Array</code></td><td>the (raw) data of this application extension</td></tr>
  </table>
</details>

## Available URL parameters

URL parameters can be in any order (_starting with `?` after the URL then parameters in format `NAME=VALUE` with `&` between each parameter_)

<details open><summary>Click to toggle table</summary>
  <table>
    <tr><th>Name</th><th>Possible values</th><th>Description</th><th>Default value</th></tr>
    <tr><td><code>gifURL</code></td><td>HTML image source (URL)<br/>(encoded URI component)</td><td>the GIF to decode and render</td><td><a href="https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif" target="_blank" rel="noopener noreferrer" title="Open Wikipedia GIF file in a new tab">this GIF from Wikipedia</a></td></tr>
    <tr><td><code>alertErrors</code></td><td>0 or 1</td><td>Errors while decoding will open an alert pop-up</td><td><code>1</code></td></tr>
    <tr><td><code>forceClearLastFrame</code></td><td>0 or 1</td><td>Forces to clear the screen after the last frame, regardless of what the GIF file says</td><td><code>1</code></td></tr>
  </table>
</details>
