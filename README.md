# GIF_decoder

GIF decoding and rendering with HTML5 canvas

## Available URL parameters

URL parameters can be in any order (_starting with `?` after the URL then parameters in format `PARAMETER=VALUE` with `&` between each parameter_)

<details open><summary>click to hide table</summary>
  <table>
    <tr><th><code>parameter</code></th><th>possible values</th><th>description</th><th>default value</th></tr>
    <tr><td><code>gifURL</code></td><td>HTML image source (URL)<br/>(encoded URI component)</td><td>the GIF to decode and render</td><td><a href="https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif" target="_blank" rel="noopener noreferrer" title="Open Wikipedia GIF file in a new tab">this GIF from Wikipedia</a></td></tr>
    <tr><td><code>alertErrors</code></td><td>0 or 1</td><td>Errors while decoding will open an alert pop-up</td><td><code>1</code></td></tr>
    <tr><td><code>forceClearLastFrame</code></td><td>0 or 1</td><td>Forces to clear the screen after the last frame, regardless of what the GIF file says</td><td><code>1</code></td></tr>
  </table>
</details>
