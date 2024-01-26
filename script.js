// @ts-check
"use strict";

//~  _____ ___________       _                    _
//~ |  __ \_   _|  ___|     | |                  | |
//~ | |  \/ | | | |_      __| | ___  ___ ___   __| | ___
//~ | | __  | | |  _|    / _` |/ _ \/ __/ _ \ / _` |/ _ \
//~ | |_\ \_| |_| |     | (_| |  __/ (_| (_) | (_| |  __/
//~  \____/\___/\_|      \__,_|\___|\___\___/ \__,_|\___|

/**
 * @typedef {Object} GIF
 * @property {number} width the width of the image in pixels (logical screen size)
 * @property {number} height the height of the image in pixels (logical screen size)
 * @property {number} totalTime the (maximum) total duration of the gif in milliseconds (all delays added together) - will be `Infinity` if there is a frame with the user input delay flag set and no timeout
 * @property {number} colorRes the color depth/resolution in bits per color (in the original) [1-8 bits]
 * @property {number} pixelAspectRatio if non zero the pixel aspect ratio will be from 4:1 to 1:4 in 1/64th increments
 * @property {boolean} sortFlag if the colors in the global color table are ordered after decreasing importance
 * @property {[number,number,number][]} globalColorTable the global color table for the GIF
 * @property {number|null} backgroundColorIndex index of the background color into the global color table (if the global color table is not available it's `null`) - can be used as a background before the first frame
 * @property {Frame[]} frames each frame of the GIF (decoded into single images)
 * @property {[string,string][]} comments comments in the file and were they where found (`[<area found>,<comment>]`)
 * @property {ApplicationExtension[]} applicationExtensions all application extensions found
 * @property {[number,Uint8Array][]} unknownExtensions all unknown extensions found (`[<identifier-1B>,<raw bytes>]`)
 * @typedef {Object} ApplicationExtension
 * @property {string} identifier 8 character string identifying the application
 * @property {string} authenticationCode 3 bytes to authenticate the application identifier
 * @property {Uint8Array} data the (raw) data of this application extension
 * @typedef {Object} Frame
 * @property {number} left the position of the left edge of this frame, in pixels, within the gif (from the left edge)
 * @property {number} top the position of the top edge of this frame, in pixels, within the gif (from the top edge)
 * @property {number} width the width of this frame in pixels
 * @property {number} height the height of this frame in pixels
 * @property {DisposalMethod} disposalMethod disposal method see {@link DisposalMethod}
 * @property {number|null} transparentColorIndex the transparency index into the local or global color table (`null` if not encountered)
 * @property {ImageData} image this frames image data
 * @property {PlainTextData|null} plainTextData the text that will be displayed on screen with this frame (`null` if not encountered)
 * @property {boolean} userInputDelayFlag if set waits for user input before rendering the next frame (timeout after delay if that is non-zero)
 * @property {number} delayTime the delay of this frame in milliseconds (`0` is undefined (_wait for user input or skip frame_) - `10`ms precision)
 * @property {boolean} sortFlag if the colors in the local color table are ordered after decreasing importance
 * @property {[number,number,number][]} localColorTable the local color table for this frame
 * @property {number} reserved _reserved for future use_ 2bits (from packed field in image descriptor block)
 * @property {number} GCreserved _reserved for future use_ 3bits (from packed field in graphics control extension block)
 * @typedef {Object} PlainTextData
 * @property {number} left the position of the left edge of text grid (in pixels) within the GIF (from the left edge)
 * @property {number} top the position of the top edge of text grid (in pixels) within the GIF (from the top edge)
 * @property {number} width the width of the text grid (in pixels)
 * @property {number} height the height of the text grid (in pixels)
 * @property {number} charWidth the width (in pixels) of each cell (character) in text grid
 * @property {number} charHeight the height (in pixels) of each cell (character) in text grid
 * @property {number} foregroundColor the index into the global color table for the foreground color of the text
 * @property {number} backgroundColor the index into the global color table for the background color of the text
 * @property {string} text the text to render on screen
 */
/**@enum {number} (not flags, can only be one)*/
const DisposalMethod=Object.freeze({
    /**unspecified > replaces entire frame*/Replace:0,
    /**do not dispose > combine with previous frame*/Combine:1,
    /**restore to background > combine with first frame (background)*/RestoreBackground:2,
    /**restore to previous > restore to previous undisposed frame state then combine*/RestorePrevious:3,
    /**undefined > fallback to `Replace`*/UndefinedA:4,
    /**undefined > fallback to `Replace`*/UndefinedB:5,
    /**undefined > fallback to `Replace`*/UndefinedC:6,
    /**undefined > fallback to `Replace`*/UndefinedD:7,
});
/**
 * ## Decodes a GIF into its components for rendering on a canvas
 * @param {string} gifURL - the URL of a GIF file
 * @param {(percentageRead:number,frameIndex:number,frame:ImageData,framePos:[number,number],gifSize:[number,number])=>any} [progressCallback] - Optional callback for showing progress of decoding process (when GIF is interlaced calls after each pass (4x on the same frame)) - if asynchronous, it waits for it to resolve
 * @param {boolean} [avgAlpha] - if this is `true` then, when encountering a transparent pixel, it uses the average value of the pixels RGB channels to calculate the alpha channels value, otherwise alpha channel is either 0 or 1 - _default `false`_
 * @returns {Promise<GIF>} the GIF with each frame decoded separately - may reject for the following reasons
 * - `fetch error` when trying to fetch the GIF from {@linkcode gifURL}
 * - `fetch aborted` when trying to fetch the GIF from {@linkcode gifURL}
 * - `loading error [CODE]` when URL yields a status code that's NOT between 200 and 299 (inclusive)
 * - `not a supported GIF file` when GIF version is NOT `GIF89a`
 * - `error while parsing frame [INDEX] "ERROR"` while decoding GIF - one of the following
 * - - `GIF frame size is to large`
 * - - `plain text extension without global color table`
 * - - `undefined block found`
 * @throws {TypeError} if {@linkcode gifURL} is not a string, {@linkcode progressCallback} is given but not a function, or {@linkcode avgAlpha} is given but not a boolean
 */
const decodeGIF=async(gifURL,progressCallback,avgAlpha)=>{
    "use strict";
    if(typeof gifURL!=="string")throw new TypeError("[decodeGIF] gifURL is not a string");
    progressCallback??=()=>null;
    if(typeof progressCallback!=="function")throw new TypeError("[decodeGIF] progressCallback is not a function");
    avgAlpha??=false;
    if(typeof avgAlpha!=="boolean")throw TypeError("[decodeGIF] avgAlpha is not a boolean");
    /**
     * @typedef {Object} ByteStream
     * @property {number} pos current position in `data`
     * @property {Uint8ClampedArray} data this streams raw data
     * @property {()=>number} nextByte get the next byte and increase cursors position by one
     * @property {()=>number} nextTwoBytes reads two bytes as one number (in reverse byte order)
     * @property {(count:number)=>string} getString returns a string from current `pos` of length `count`
     * @property {()=>string} readSubBlocks reads a set of blocks as a string
     * @property {()=>Uint8Array} readSubBlocksBin reads a set of blocks as binary
     * @property {()=>void} skipSubBlocks skips the next set of blocks in the stream
     */
    /**@type {(bytes:Iterable<number>)=>ByteStream}*/
    const newByteStream=(bytes)=>Object.preventExtensions({
        pos:0,
        data:new Uint8ClampedArray(bytes),
        nextByte(){
            "use strict";
            return this.data[this.pos++];
        },
        nextTwoBytes(){
            "use strict";
            this.pos+=2;
            return this.data[this.pos-2]+(this.data[this.pos-1]<<8);
        },
        getString(count){
            "use strict";
            let s="";
            for(;--count>=0;s+=String.fromCharCode(this.data[this.pos++]));
            return s;
        },
        readSubBlocks(){
            "use strict";
            let blockString="",size=0;
            do{
                size=this.data[this.pos++];
                for(let count=size;--count>=0;blockString+=String.fromCharCode(this.data[this.pos++]));
            }while(size!==0);
            return blockString;
        },
        readSubBlocksBin(){
            "use strict";
            let size=0,len=0;
            for(let offset=0;(size=this.data[this.pos+offset])!==0;offset+=size+1)len+=size;
            const blockData=new Uint8Array(len);
            for(let i=0;(size=this.data[this.pos++])!==0;)
                for(let count=size;--count>=0;blockData[i++]=this.data[this.pos++]);
            return blockData;
        },
        skipSubBlocks(){
            "use strict";
            for(;this.data[this.pos]!==0;this.pos+=this.data[this.pos]+1);
            this.pos++;
        }
    });
    /**@type {readonly[0,4,2,1]}*/
    const InterlaceOffsets=Object.freeze([0,4,2,1]);
    /**@type {readonly[8,8,4,2]}*/
    const InterlaceSteps=Object.freeze([8,8,4,2]);
    /**@enum {number}*/
    const GIFDataHeaders=Object.freeze({
        /**extension introducer*/Extension:0x21,
        /**extension label: application*/ApplicationExtension:0xFF,
        /**extension label: graphic control*/GraphicsControlExtension:0xF9,
        /**extension label: plain text*/PlainTextExtension:1,
        /**extension label: comment*/CommentExtension:0xFE,
        /**image seperator*/Image:0x2C,
        /**trailer > end of file / GIF data*/EndOfFile:0x3B,
    });
    /**
     * ## Get a color table of length `count`
     * @param {ByteStream} byteStream - GIF data stream
     * @param {number} count - number of colours to read from `byteStream`
     * @returns {[number,number,number][]} an array of RGB color values
     */
    const parseColorTable=(byteStream,count)=>{
        "use strict";
        /**@type {[number,number,number][]}*/
        const colors=[];
        for(let i=0;i<count;i++){
            colors.push([
                byteStream.data[byteStream.pos],
                byteStream.data[byteStream.pos+1],
                byteStream.data[byteStream.pos+2]
            ]);
            byteStream.pos+=3;
        }
        return colors;
    }
    /**
     * ## Parsing one block from GIF data stream
     * @param {ByteStream} byteStream - GIF data stream
     * @param {GIF} gif - GIF object to write to
     * @param {(increment?:boolean)=>number} getFrameIndex - function to get current frame index in `GIF.frames` (optionally increment before next cycle)
     * @param {(replace?:string)=>string} getLastBlock - function to get last block read (optionally replace for next call)
     * @returns {Promise<boolean>} true if EOF was reached
     * @throws {EvalError} for the following reasons
     * - GIF frame size is to large
     * - plain text extension without global color table
     * - undefined block found
     */
    const parseBlock=async(byteStream,gif,getFrameIndex,getLastBlock)=>{
        "use strict";
        switch(byteStream.nextByte()){
            case GIFDataHeaders.EndOfFile:return true;
            case GIFDataHeaders.Image:
                //~ parse frame image - image descriptor
                const frame=gif.frames[getFrameIndex(true)];
                //~ image left position (2B) - position of the left edge of the frame (in pixels) within the GIF (from the left edge)
                frame.left=byteStream.nextTwoBytes();
                //~ image top position (2B) - position of the top edge of the frame (in pixels) within the GIF (from the top edge)
                frame.top=byteStream.nextTwoBytes();
                //~ image width (2B) - width of the frame (in pixels)
                frame.width=byteStream.nextTwoBytes();
                //~ image height (2B) - height of the frame (in pixels)
                frame.height=byteStream.nextTwoBytes();
                //~ packed byte (1B) >
                const packedByte=byteStream.nextByte();
                //~ > local color table flag (1b) - if set there will be a local color table otherwise use the global color table
                const localColorTableFlag=(packedByte&0x80)===0x80;
                //~ > interlaced flag (1b) - if set image is interlaced (4-pass interlace pattern)
                const interlacedFlag=(packedByte&0x40)===0x40;
                //~ > sort flag (1b) - if the colors in the local color table are ordered after decreasing importance
                frame.sortFlag=(packedByte&0x20)===0x20;
                //~ > reserved (2b) - reserved for future use
                frame.reserved=(packedByte&0x18)>>>3;
                //~ > size of local color table (3b) - number of bits minus 1 [1-8 bits] (256 colors max)
                const localColorCount=1<<((packedByte&7)+1);
                //~ read local color table if available
                if(localColorTableFlag)frame.localColorTable=parseColorTable(byteStream,localColorCount);
                //~ decode frame image data (GIF-LZW) - image data
                /**
                 * ## Get color from color tables (transparent if index is equal to the transparency index)
                 * @param {number} index - index into global/local color table
                 * @returns {[number,number,number,number]} RGBA color value
                 */
                const getColor=index=>{
                    "use strict";
                    const[R,G,B]=(localColorTableFlag?frame.localColorTable:gif.globalColorTable)[index];
                    return[R,G,B,index===frame.transparentColorIndex?(avgAlpha?~~((R+G+B)/3):0):0xFF];
                }
                const image=(()=>{
                    "use strict";
                    try{return new ImageData(frame.width,frame.height,{colorSpace:"srgb"});}
                    catch(error){
                        if(error instanceof DOMException&&error.name==="IndexSizeError")return null;
                        throw error;
                    }
                })();
                if(image==null)throw new EvalError("GIF frame size is to large");
                const minCodeSize=byteStream.nextByte();
                const imageData=byteStream.readSubBlocksBin();
                const clearCode=1<<minCodeSize;
                /**
                 * ## Read {@linkcode len} bits from {@linkcode imageData} at {@linkcode pos}
                 * @param {number} pos - bit position in {@linkcode imageData}
                 * @param {number} len - bit length to read [1 to 12 bits]
                 * @returns {number} - {@linkcode len} bits at {@linkcode pos}
                 */
                const readBits=(pos,len)=>{
                    "use strict";
                    const bytePos=pos>>>3,
                        bitPos=pos&7;
                    return((imageData[bytePos]+(imageData[bytePos+1]<<8)+(imageData[bytePos+2]<<0x10))&(((1<<len)-1)<<bitPos))>>>bitPos;
                };
                if(interlacedFlag){
                    for(let code=0,size=minCodeSize+1,pos=0,dic=[[0]],pass=0;pass<4;pass++){
                        if(InterlaceOffsets[pass]<frame.height)
                            for(let pixelPos=0,lineIndex=0;true;){
                                const last=code;
                                code=readBits(pos,size);
                                pos+=size+1;
                                if(code===clearCode){
                                    size=minCodeSize+1;
                                    dic.length=clearCode+2;
                                    for(let i=0;i<dic.length;i++)dic[i]=i<clearCode?[i]:[];
                                }else{
                                    if(code>=dic.length)dic.push(dic[last].concat(dic[last][0]));
                                    else if(last!==clearCode)dic.push(dic[last].concat(dic[code][0]));
                                    for(let i=0;i<dic[code].length;i++){
                                        image.data.set(getColor(dic[code][i]),InterlaceOffsets[pass]*frame.width+InterlaceSteps[pass]*lineIndex+(pixelPos%(frame.width*4)));
                                        pixelPos+=4;
                                    }
                                    if(dic.length===(1<<size)&&size<0xC)size++;
                                }
                                if(pixelPos===frame.width*4*(lineIndex+1)){
                                    lineIndex++;
                                    if(InterlaceOffsets[pass]+InterlaceSteps[pass]*lineIndex>=frame.height)break;
                                }
                            }
                        //@ts-ignore variable is checked for type function in parent scope
                        await progressCallback((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),image,[frame.left,frame.top],[gif.width,gif.height]);
                    }
                    frame.image=image;
                }else{
                    for(let code=0,size=minCodeSize+1,pos=0,dic=[[0]],pixelPos=-4;true;){
                        const last=code;
                        code=readBits(pos,size);
                        pos+=size;
                        if(code===clearCode){
                            size=minCodeSize+1;
                            dic.length=clearCode+2;
                            for(let i=0;i<dic.length;i++)dic[i]=i<clearCode?[i]:[];
                        }else{
                            //~ clear code +1 = end of information code
                            if(code===clearCode+1)break;
                            if(code>=dic.length)dic.push(dic[last].concat(dic[last][0]));
                            else if(last!==clearCode)dic.push(dic[last].concat(dic[code][0]));
                            for(let i=0;i<dic[code].length;i++)image.data.set(getColor(dic[code][i]),pixelPos+=4);
                            if(dic.length>=(1<<size)&&size<0xC)size++;
                        }
                    }
                    //@ts-ignore variable is checked for type function in parent scope
                    await progressCallback((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),frame.image=image,[frame.left,frame.top],[gif.width,gif.height]);
                }
                getLastBlock(`frame [${getFrameIndex()}]`);
            break;
            case GIFDataHeaders.Extension:
                switch(byteStream.nextByte()){
                    case GIFDataHeaders.GraphicsControlExtension:
                        //~ parse graphics control extension data - applies to the next frame in the byte stream
                        const frame=gif.frames[getFrameIndex()];
                        //~ block size (1B) - static 4 - byte size of the block up to (but excluding) the Block Terminator
                        byteStream.pos++;
                        //~ packed byte (1B) >
                        const packedByte=byteStream.nextByte();
                        //~ > reserved (3b) - reserved for future use
                        frame.GCreserved=(packedByte&0xE0)>>>5;
                        //~ > disposal method (3b) - [0-7] - 0: unspecified (no action) 1: combine (no dispose) 2: restore background 3: restore previous 4-7: undefined
                        frame.disposalMethod=(packedByte&0x1C)>>>2;
                        //~ > user input flag (1b) - if 1 then continues (rendering) after user input (or delay-time, if given)
                        frame.userInputDelayFlag=(packedByte&2)===2;
                        //~ > transparent color flag (1b) - indicates that, if set, the following transparency index should be used to ignore each color with this index in the following frame
                        const transparencyFlag=(packedByte&1)===1;
                        //~ delay time (2B) - if non-zero specifies the number of 1/100 seconds (here converted to milliseconds) to delay (rendering of) the following frame
                        frame.delayTime=byteStream.nextTwoBytes()*0xA;
                        //~ transparency index (1B) - color index of transparent color for following frame (only use if transparency flag is set - byte is always present)
                        if(transparencyFlag)frame.transparentColorIndex=byteStream.nextByte();
                        else byteStream.pos++;
                        //~ block terminator (1B) - static 0 - marks end of graphics control extension block
                        byteStream.pos++;
                        getLastBlock(`graphics control extension for frame [${getFrameIndex()}]`);
                    break;
                    case GIFDataHeaders.ApplicationExtension:
                        //~ parse application extension - application-specific information
                        /**@type {ApplicationExtension}*/
                        const applicationExtension={};
                        //~ block size (1B) - static 11 - byte size of the block up to (but excluding) the application data blocks
                        byteStream.pos++;
                        //~ application identifier (8B) - 8 character string identifying the application (of this extension block)
                        applicationExtension.identifier=byteStream.getString(8);
                        //~ application authentication code (3B) - 3 bytes to authenticate the application identifier
                        applicationExtension.authenticationCode=byteStream.getString(3);
                        //~ application data blocks - the data of this application extension
                        applicationExtension.data=byteStream.readSubBlocksBin();
                        getLastBlock(`application extension [${gif.applicationExtensions.length}] ${applicationExtension.identifier}${applicationExtension.authenticationCode}`);
                        gif.applicationExtensions.push(applicationExtension);
                    break;
                    case GIFDataHeaders.CommentExtension:
                        //~ parse comment extension - one or more blocks each stating their size (1B) [1-255]
                        gif.comments.push([getLastBlock(`[${byteStream.pos}] after ${getLastBlock()}`),byteStream.readSubBlocks()]);
                    break;
                    case GIFDataHeaders.PlainTextExtension:
                        //~ parse plain text extension - text to render with the following frame (needs global color table)
                        if(gif.globalColorTable.length===0)throw new EvalError("plain text extension without global color table");
                        //~ block size (1B) - static 12 - byte size of the block up to (but excluding) the plain text data blocks
                        byteStream.pos++;
                        /**@type {PlainTextData}*/
                        const plainTextData={};
                        //~ text grid left position (2B) - position of the left edge of text grid (in pixels) within the GIF (from the left edge)
                        plainTextData.left=byteStream.nextTwoBytes();
                        //~ text grid top position (2B) - position of the top edge of text grid (in pixels) within the GIF (from the top edge)
                        plainTextData.top=byteStream.nextTwoBytes();
                        //~ text grid width (2B) - width of the text grid (in pixels)
                        plainTextData.width=byteStream.nextTwoBytes();
                        //~ text grid height (2B) - height of the text grid (in pixels)
                        plainTextData.height=byteStream.nextTwoBytes();
                        //~ text character cell width (2B) - width (in pixels) of each cell (character) in text grid
                        plainTextData.charWidth=byteStream.nextTwoBytes();
                        //~ text character cell height (2B) - height (in pixels) of each cell (character) in text grid
                        plainTextData.charHeight=byteStream.nextTwoBytes();
                        //~ text foreground color index (1B) - index into the global color table for the foreground color of the text
                        plainTextData.foregroundColor=byteStream.nextByte();
                        //~ text background color index (1B) - index into the global color table for the background color of the text
                        plainTextData.backgroundColor=byteStream.nextByte();
                        //~ plain text data - one or more blocks each stating their size (1B) [1-255]
                        plainTextData.text=byteStream.readSubBlocks();
                        gif.frames[getFrameIndex()].plainTextData=plainTextData;
                        getLastBlock(`text extension for frame ${getFrameIndex()}]`);
                    break;
                    default:
                        const extID=byteStream.data[byteStream.pos-1];
                        getLastBlock(`unknown extension [${gif.unknownExtensions.length}] #${extID.toString(0x10).toUpperCase().padStart(2,'0')}`);
                        //~ read unknown extension with unknown length
                        gif.unknownExtensions.push([extID,byteStream.readSubBlocksBin()]);
                    break;
                }
            break;
            default:throw new EvalError("undefined block found");
        }
        return false;
    }
    return new Promise((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        xhr.responseType="arraybuffer";
        xhr.onload=async()=>{
            if(xhr.status<0xC8||xhr.status>=0x12C){reject(`loading error [${xhr.status}]`);return;}
            //? https://www.w3.org/Graphics/GIF/spec-gif89a.txt
            //? https://www.matthewflickinger.com/lab/whatsinagif/bits_and_bytes.asp
            //~ load stream and start decoding
            /**@type {GIF} the output gif object*/
            const gif={
                    width:0,
                    height:0,
                    totalTime:0,
                    colorRes:0,
                    pixelAspectRatio:0,
                    frames:[],
                    sortFlag:false,
                    globalColorTable:[],
                    backgroundColorIndex:null,
                    comments:[],
                    applicationExtensions:[],
                    unknownExtensions:[]
                },
                byteStream=newByteStream(xhr.response);
            //~ signature (3B) and version (3B)
            if(byteStream.getString(6)!=="GIF89a"){reject("not a supported GIF file");return;}
            //~ width (2B) - in pixels
            gif.width=byteStream.nextTwoBytes();
            //~ height (2B) - in pixels
            gif.height=byteStream.nextTwoBytes();
            //~ packed byte (1B) >
            const packedByte=byteStream.nextByte();
            //~ > global color table flag (1b) - if there will be a global color table
            const globalColorTableFlag=(packedByte&0x80)===0x80;
            //~ > color resolution (3b) - bits per color minus 1 [1-8 bits] (256 colors max)
            gif.colorRes=(packedByte&0x70)>>>4;
            //~ > sort flag (1b) - if the colors in the global color table are ordered after decreasing importance
            gif.sortFlag=(packedByte&8)===8;
            //~ > size of global color table (3b) - number of bits minus 1 [1-8 bits] (256 colors max)
            const globalColorCount=1<<((packedByte&7)+1);
            //~ background color index (1B) - when global color table exists this points to the color (index) that should be used for pixels without color data (byte is always present)
            if(globalColorTableFlag)gif.backgroundColorIndex=byteStream.nextByte();
            else byteStream.pos++;
            //~ pixel aspect ratio (1B) - if non zero the pixel aspect ratio will be `(value + 15) / 64` from 4:1 to 1:4 in 1/64th increments
            gif.pixelAspectRatio=byteStream.nextByte();
            if(gif.pixelAspectRatio!==0)gif.pixelAspectRatio=(gif.pixelAspectRatio+0xF)/0x40;
            //~ parse global color table if there is one
            if(globalColorTableFlag)gif.globalColorTable=parseColorTable(byteStream,globalColorCount);
            //~ parse other blocks ↓
            let frameIndex=-1,
                incrementFrameIndex=true,
                lastBlock="parsing global GIF info";
            /**
             * ## Get the index of the current frame
             * @param {boolean} [increment] - if the frame index should increse before the next cycle - default `false`
             * @returns {number} current frame index
             */
            const getframeIndex=increment=>{
                "use strict";
                if(increment??false)incrementFrameIndex=true;
                return frameIndex;
            };
            /**
             * ## Get the last block parsed
             * @param {string} [replace] - if given replaces the current "last block" value with this
             * @returns {string} last block parsed
             */
            const getLastBlock=replace=>{
                "use strict";
                if(replace==null)return lastBlock;
                return lastBlock=replace;
            };
            try{
                do{
                    if(incrementFrameIndex){
                        gif.frames.push({
                            left:0,
                            top:0,
                            width:0,
                            height:0,
                            disposalMethod:DisposalMethod.Replace,
                            transparentColorIndex:null,
                            image:new ImageData(1,1,{colorSpace:"srgb"}),
                            plainTextData:null,
                            userInputDelayFlag:false,
                            delayTime:0,
                            sortFlag:false,
                            localColorTable:[],
                            reserved:0,
                            GCreserved:0,
                        });
                        frameIndex++;
                        incrementFrameIndex=false;
                    }
                }while(!await parseBlock(byteStream,gif,getframeIndex,getLastBlock));
                gif.frames.length--;
                for(const frame of gif.frames){
                    //~ set total time to infinity if the user input delay flag is set and there is no timeout
                    if(frame.userInputDelayFlag&&frame.delayTime===0){
                        gif.totalTime=Infinity;
                        break;
                    }
                    gif.totalTime+=frame.delayTime;
                }
                resolve(gif);
                return;
            }catch(error){
                if(error instanceof EvalError){reject(`error while parsing frame [${frameIndex}] "${error.message}"`);return;}
                throw error;
            }
        };
        xhr.onerror=()=>reject("fetch error");
        xhr.onabort=()=>reject("fetch aborted");
        xhr.open('GET',gifURL,true);
        xhr.send();
    });
};
/**
 * ## Extract the animation loop amount from a {@linkcode GIF}
 * Generally, for proper looping support, the `NETSCAPE2.0` extension must appear immediately after the global color table of the logical screen descriptor (at the beginning of the GIF file). Still, here, it doesn't matter where it was found.
 * @param {GIF} gif - a parsed GIF object
 * @returns {number} the loop amount of {@linkcode gif} as 16bit number (0 to 65'535 or `Infinity`)
 */
const getGIFLoopAmount=gif=>{
    for(const ext of gif.applicationExtensions)
        if(ext.authenticationCode==="2.0"&&ext.identifier==="NETSCAPE"){
            const loop=ext.data[1]+(ext.data[2]<<8);
            if(loop===0)return Infinity;
            return loop;
        }
    return 0;
};

//~  _   _ ________  ___ _       _____ _                           _
//~ | | | |_   _|  \/  || |     |  ___| |                         | |
//~ | |_| | | | | .  . || |     | |__ | | ___ _ __ ___   ___ _ __ | |_ ___
//~ |  _  | | | | |\/| || |     |  __|| |/ _ \ '_ ` _ \ / _ \ '_ \| __/ __|
//~ | | | | | | | |  | || |____ | |___| |  __/ | | | | |  __/ | | | |_\__ \
//~ \_| |_/ \_/ \_|  |_/\_____/ \____/|_|\___|_| |_| |_|\___|_| |_|\__|___/

/** HTML elements in DOM */
const html=Object.freeze({
    /** @type {HTMLElement} DOM root (`<html>`) */
    root:document.documentElement,
    /** @type {HTMLDivElement} Main container *///@ts-ignore element does exist in DOM
    box:document.getElementById("box"),
    /** @type {HTMLHeadingElement} Main page heading (element before {@linkcode html.view.view}) *///@ts-ignore element does exist in DOM
    heading:document.getElementById("gifHeading"),
    /** GIF view box (top left of the page) */
    view:Object.freeze({
        /** @type {HTMLDivElement} View box container *///@ts-ignore element does exist in DOM
        view:document.getElementById("gifView"),
        /** @type {HTMLCanvasElement} The main GIF canvas (HTML) *///@ts-ignore element does exist in DOM
        htmlCanvas:document.getElementById("htmlCanvas"),
        /** @type {CSSStyleDeclaration} Live CSS style map of {@linkcode html.view.htmlCanvas} *///@ts-ignore element does exist in DOM
        canvasStyle:window.getComputedStyle(document.getElementById("htmlCanvas")),
        /** @type {CanvasRenderingContext2D} The main GIF canvas (2D context of {@linkcode html.view.htmlCanvas}) *///@ts-ignore element does exist in DOM
        canvas:document.getElementById("htmlCanvas").getContext("2d",{colorSpace:"srgb"}),
        /** @type {HTMLDivElement} container for the {@linkcode html.view.htmlCanvas} controls *///@ts-ignore element does exist in DOM
        controls:document.getElementById("gifViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.view.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow:document.getElementById("fullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 fit to {@linkcode html.view.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow:document.getElementById("fitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 pixelated `🙾` and 1 smooth `🙼` (default) image rendering via class `pixel` *///@ts-ignore element does exist in DOM
        imgSmoothing:document.getElementById("imgSmoothing")
    }),
    /** Time and frame sliders (under {@linkcode html.view}) */
    frameTime:Object.freeze({
        /** @type {HTMLInputElement} Disabled slider for GIF time progress in milliseconds (uses tickmarks of {@linkcode html.frameTime.timeTickmarks} - in HTML: `█ ms`) *///@ts-ignore element does exist in DOM
        timeRange:document.getElementById("timeRange"),
        /** @type {HTMLSpanElement} Displays current timestamp of GIF playback in milliseconds (next to {@linkcode html.frameTime.timeRange}) *///@ts-ignore element does exist in DOM
        time:document.getElementById("time"),
        /** @type {HTMLDataListElement} List of timestamps (milliseconds) for tickmarks (under {@linkcode html.frameTime.timeRange} - `<option>MS_TIMESTAMP</option>` starting at `0` - only shows for integer values) *///@ts-ignore element does exist in DOM
        timeTickmarks:document.getElementById("timeTickmarks"),
        /** @type {HTMLInputElement} Interactible slider for frame selection *///@ts-ignore element does exist in DOM
        frameRange:document.getElementById("frameRange"),
        /** @type {HTMLSpanElement} Displays current (zero-based) frame index (next to {@linkcode html.frameTime.frameRange}) *///@ts-ignore element does exist in DOM
        frame:document.getElementById("frame")
    }),
    /** GIF playback controls (under {@linkcode html.frameTime}) */
    controls:Object.freeze({
        /** @type {HTMLDivElement} Container of the control buttons - use this to visualize playback (class `reverse`/`paused`/`playing`) *///@ts-ignore element does exist in DOM
        container:document.getElementById("playerControls"),
        /** @type {HTMLInputElement} Button to go to the first frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekStart:document.getElementById("seekStart"),
        /** @type {HTMLInputElement} Button to go to the previous frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekPrevious:document.getElementById("seekPrevious"),
        /** @type {HTMLInputElement} Button to play GIF in reverse *///@ts-ignore element does exist in DOM
        reverse:document.getElementById("reverse"),
        /** @type {HTMLInputElement} Button to pause GIF playback *///@ts-ignore element does exist in DOM
        pause:document.getElementById("pause"),
        /** @type {HTMLInputElement} Button to start GIF playback *///@ts-ignore element does exist in DOM
        play:document.getElementById("play"),
        /** @type {HTMLInputElement} Button to go to the next frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekNext:document.getElementById("seekNext"),
        /** @type {HTMLInputElement} Button to go to the last frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekEnd:document.getElementById("seekEnd")
    }),
    /** User input area (under {@linkcode html.controls}) */
    userInput:Object.freeze({
        /** @type {HTMLFieldSetElement} Container for user input controls (highlight via class `waiting` for user input and class `infinity` when infinite timeout) *///@ts-ignore element does exist in DOM
        userInputArea:document.getElementById("userInputArea"),
        /** @type {HTMLProgressElement} Progress bar to show timeout (milliseconds) for user input delay (remove `value` attribute when infinite timeout and `0` for no timeout - also update `max` accordingly (non-zero value)) *///@ts-ignore element does exist in DOM
        userInputTimeout:document.getElementById("userInputTimeout"),
        /** @type {HTMLSpanElement} Shows timeout for user input in milliseconds (see {@linkcode html.userInput.userInputTimeout} - `∞` when infinite timeout and empty for no timeout - in HTML: `█ ms`) *///@ts-ignore element does exist in DOM
        userInputTimeoutTime:document.getElementById("userInputTimeoutTime"),
        /** @type {HTMLInputElement} Button for user input, continues playback when waiting for user input *///@ts-ignore element does exist in DOM
        userInput:document.getElementById("userInput"),
        /** @type {HTMLInputElement} Button to `data-toggle` user input lock (1 ON / 0 OFF (default)) if ON, does not wait and continues playback instantly *///@ts-ignore element does exist in DOM
        userInputLock:document.getElementById("userInputLock")
    }),
    /** @type {HTMLDivElement} Main info panel container (right side of the page) *///@ts-ignore element does exist in DOM
    infoPanels:document.getElementById("infoPanels"),
    /** Collapsable areas in {@linkcode html.infoPanels} */
    details:Object.freeze({
        /** @type {HTMLDetailsElement} Collapsable area for the GIF info *///@ts-ignore element does exist in DOM
        gifInfo:document.getElementById("detailsGIFInfo"),
        /** @type {HTMLDetailsElement} Collapsable container of {@linkcode html.info.globalColorTable} *///@ts-ignore element does exist in DOM
        globalColorTable:document.getElementById("detailsGlobalColorTable"),
        /** @type {HTMLDetailsElement} Collapsable container of {@linkcode html.info.appExtList} *///@ts-ignore element does exist in DOM
        appExtList:document.getElementById("detailsAppExtList"),
        /** @type {HTMLDetailsElement} Collapsable container of {@linkcode html.info.commentsList} *///@ts-ignore element does exist in DOM
        commentsList:document.getElementById("detailsCommentsList"),
        /** @type {HTMLDetailsElement} Collapsable container of {@linkcode html.info.unExtList} *///@ts-ignore element does exist in DOM
        unExtList:document.getElementById("detailsUnExtList"),
        /** @type {HTMLDetailsElement} Collapsable area for the frame view (container of {@linkcode html.frame.view}) *///@ts-ignore element does exist in DOM
        frameView:document.getElementById("detailsFrameView"),
        /** @type {HTMLDetailsElement} Collapsable area for the frame info *///@ts-ignore element does exist in DOM
        frameInfo:document.getElementById("detailsFrameInfo"),
        /** @type {HTMLDetailsElement} Collapsable container of {@linkcode html.frame.localColorTable} *///@ts-ignore element does exist in DOM
        localColorTable:document.getElementById("detailsFrameColorTable"),
        /** @type {HTMLDetailsElement} Collapsable area for the frame text info *///@ts-ignore element does exist in DOM
        frameText:document.getElementById("detailsFrameTextInfo")
    }),
    /** Progressbars for indicating gif decoding progress (does not allow canvas view controls) */
    loading:Object.freeze({
        /** @type {HTMLDivElement} Progress container over {@linkcode html.view.view} (of {@linkcode html.loading.gifText} and {@linkcode html.loading.gifProgress}) *///@ts-ignore element does exist in DOM
        gif:document.getElementById("gifLoad"),
        /** @type {HTMLParagraphElement} Progress text over {@linkcode html.loading.gifProgress} (format: `Frame I | P%` with padding to minimize flickering) *///@ts-ignore element does exist in DOM
        gifText:document.getElementById("gifLoadText"),
        /** @type {HTMLProgressElement} Progress bar under {@linkcode html.loading.gifText} (0 to 1 - class `done` afterwards) *///@ts-ignore element does exist in DOM
        gifProgress:document.getElementById("gifLoadProgress"),
        /** @type {HTMLDivElement} Progress container over {@linkcode html.frame.view} (of {@linkcode html.loading.frameText} and {@linkcode html.loading.frameProgress}) *///@ts-ignore element does exist in DOM
        frame:document.getElementById("frameLoad"),
        /** @type {HTMLParagraphElement} Progress text over {@linkcode html.loading.frameProgress} (format: `Frame I | P%` with padding to minimize flickering) *///@ts-ignore element does exist in DOM
        frameText:document.getElementById("frameLoadText"),
        /** @type {HTMLProgressElement} Progress bar under {@linkcode html.loading.frameText} (0 to 1 - class `done` afterwards) *///@ts-ignore element does exist in DOM
        frameProgress:document.getElementById("frameLoadProgress")
    }),
    /** @type {HTMLInputElement} Button that opens the {@linkcode html.import.menu} (at the top of {@linkcode html.infoPanels}) *///@ts-ignore element does exist in DOM
    open:document.getElementById("open"),
    /** GIF info panel (collapsable) */
    info:Object.freeze({
        /** @type {HTMLTableCellElement} Shows the name of the GIF file *///@ts-ignore element does exist in DOM
        fileName:document.getElementById("fileName"),
        /** @type {HTMLSpanElement} Shows the total width of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        totalWidth:document.getElementById("totalWidth"),
        /** @type {HTMLSpanElement} Shows the total height of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        totalHeight:document.getElementById("totalHeight"),
        /** @type {HTMLTableCellElement} Shows the total number of frames of the GIF *///@ts-ignore element does exist in DOM
        totalFrames:document.getElementById("totalFrames"),
        /** @type {HTMLTableCellElement} Shows the total time of the GIF (in milliseconds) *///@ts-ignore element does exist in DOM
        totalTime:document.getElementById("totalTime"),
        /** @type {HTMLTableCellElement} Shows the pixel ascpect ratio of the GIF (in format `w:h` ie. `1:1`) *///@ts-ignore element does exist in DOM
        pixelAspectRatio:document.getElementById("pixelAspectRatio"),
        /** @type {HTMLTableCellElement} Shows the color resolution of the GIF (in bits) *///@ts-ignore element does exist in DOM
        colorRes:document.getElementById("colorRes"),
        /** @type {HTMLDivElement} List of colors in the global color table of the GIF (`<label title="Color index I - click to copy hex code">[I] <input type="color"></label>` (optionaly with class `background-flag` / `transparent-flag` and addition to title) for each color or `<span>Empty list (see local color tables)</span>`) *///@ts-ignore element does exist in DOM
        globalColorTable:document.getElementById("globalColorTable"),
        /** @type {HTMLDivElement} List of GIF application extensions in RAW binary (`<fieldset><legend title="Application-Extension identifier (8 characters) and authentication code (3 characters)">#I APPLICAT1.0</legend><span title="Description">unknown application extension</span> <input type="button" title="Click to copy raw binary to clipboard" value="Copy raw binary"></fieldset>` for each app. ext. or `<span>Empty list</span>`) *///@ts-ignore element does exist in DOM
        appExtList:document.getElementById("appExtList"),
        /** @type {HTMLDivElement} List of comments in the GIF file (`<div title="Comment #I found in GIF file at AREA_FOUND">Comment #I at AREA_FOUND<textarea readonly>COMMENT</textarea></div>` for each frame/comment or `<span>Empty list</span>`) *///@ts-ignore element does exist in DOM
        commentsList: document.getElementById("commentsList"),
        /** @type {HTMLDivElement} List of unknown extensions in the GIF file in RAW binary (`<div title="(Unknown) Extension identifier (1 character)"><span>#I W <small>(0x57)</small></span><input type="button" title="Click to copy raw binary to clipboard" value="Copy raw binary"></div>` for each unknown extension or `<span>Empty list</span>`) *///@ts-ignore element does exist in DOM
        unExtList:document.getElementById("unExtList")
    }),
    /** GIF frame info panel (collapsable) */
    frame:Object.freeze({
        /** @type {HTMLDivElement} Collapsable (frame) view box container *///@ts-ignore element does exist in DOM
        view:document.getElementById("frameView"),
        /** @type {HTMLCanvasElement} The frame canvas (HTML) for the current frame *///@ts-ignore element does exist in DOM
        htmlCanvas:document.getElementById("htmlFrameCanvas"),
        /** @type {CSSStyleDeclaration} Live CSS style map of {@linkcode html.frame.htmlCanvas} *///@ts-ignore element does exist in DOM
        canvasStyle:window.getComputedStyle(document.getElementById("htmlFrameCanvas")),
        /** @type {CanvasRenderingContext2D} The frame canvas (2D context of {@linkcode html.frame.htmlCanvas}) for the current frame *///@ts-ignore element does exist in DOM
        canvas:document.getElementById("htmlFrameCanvas").getContext("2d",{colorSpace:"srgb"}),
        /** @type {HTMLDivElement} container for the {@linkcode html.frame.hmtlCanvas} controls *///@ts-ignore element does exist in DOM
        controls:document.getElementById("frameViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.frame.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow:document.getElementById("frameFullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 fit to {@linkcode html.frame.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow:document.getElementById("frameFitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 pixelated `🙾` and 1 smooth `🙼` (default) image rendering via class `pixel` *///@ts-ignore element does exist in DOM
        imgSmoothing:document.getElementById("frameImgSmoothing"),
        /** @type {HTMLSpanElement} Shows the width of the current frame (in pixels) *///@ts-ignore element does exist in DOM
        width:document.getElementById("frameWidth"),
        /** @type {HTMLSpanElement} Shows the height of the current frame (in pixels) *///@ts-ignore element does exist in DOM
        height:document.getElementById("frameHeight"),
        /** @type {HTMLSpanElement} Shows the position of the current frame from the left edge of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        left:document.getElementById("frameLeft"),
        /** @type {HTMLSpanElement} Shows the position of the current frame from the top edge of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        top:document.getElementById("frameTop"),
        /** @type {HTMLTableCellElement} Shows the time in milliseconds this frame is displayed for *///@ts-ignore element does exist in DOM
        time:document.getElementById("frameTime"),
        /** @type {HTMLInputElement} Disabled checkbox to show if this frame is waiting for user input *///@ts-ignore element does exist in DOM
        userInputFlag:document.getElementById("frameUserInputFlag"),
        /** @type {HTMLTableCellElement} Readonly, shows the disposal method of the current frame (index, text, and meaning) *///@ts-ignore element does exist in DOM
        disposalMethod:document.getElementById("frameDisposalMethod"),
        /** @type {HTMLTableCellElement} Reserved field {@linkcode Frame.reserved} (format: `- (0b00)`) *///@ts-ignore element does exist in DOM
        frameReserved:document.getElementById("frameReserved"),
        /** @type {HTMLTableCellElement} Reserved field {@linkcode Frame.GCreserved} (format: `- (0b000)`) *///@ts-ignore element does exist in DOM
        frameGCReserved:document.getElementById("frameGCReserved"),
        /** @type {HTMLDivElement} List of colors in the local color table of the current frame (`<label title="Color index I - click to copy hex code">[I] <input type="color"></label>` (optionaly with class `background-flag` / `transparent-flag` and addition to title) for each color or `<span>Empty list (see global color table)</span>`) *///@ts-ignore element does exist in DOM
        localColorTable:document.getElementById("frameColorTable"),
        /**
         * Text information for this frame (only exist if a global color table is present)
         * - characters other than `0x20` to `0xF7` are interpreted as `0x20`
         * - each character is rendered seperatly (in one cell each)
         * - monospace font, size to cell height / width (measure font character w/h aspect and fit it to width if it's smaller)
         * - cells are tiled from tp left, to right, then bottom (fractional cells are skiped)
         * - if grid is filled and there are characters left, ignore them
         */
        text:Object.freeze({
            /** @type {HTMLDivElement} The text extension container (add class `empty` if current frame doesn't have a text extension) *///@ts-ignore element does exist in DOM
            area:document.getElementById("frameTextArea"),
            /** @type {HTMLTableCellElement} The text to display on top of the current frame *///@ts-ignore element does exist in DOM
            text:document.getElementById("frameText"),
            /** Grid information of this text */
            grid:Object.freeze({
                /** @type {HTMLSpanElement} The width of the text grid in pixels *///@ts-ignore element does exist in DOM
                width:document.getElementById("frameTextWidth"),
                /** @type {HTMLSpanElement} The height of the text grid in pixels *///@ts-ignore element does exist in DOM
                height:document.getElementById("frameTextHeight"),
                /** @type {HTMLSpanElement} The (top left) position of the text grid from the left edge of the GIF (logical screen) in pixels *///@ts-ignore element does exist in DOM
                left:document.getElementById("frameTextLeft"),
                /** @type {HTMLSpanElement} The (top left) position of the text grid from the top edge of the GIF (logical screen) in pixels *///@ts-ignore element does exist in DOM
                top:document.getElementById("frameTextTop")
            }),
            /** Cell information of this text */
            cell:Object.freeze({
                /** @type {HTMLSpanElement} The width of each character cell in pixels (should tile the text grid perfectly) *///@ts-ignore element does exist in DOM
                width:document.getElementById("frameTextCharWidth"),
                /** @type {HTMLSpanElement} The height of each character cell in pixels (should tile the text grid perfectly) *///@ts-ignore element does exist in DOM
                height:document.getElementById("frameTextCharHeight"),
            }),
            /** @type {HTMLInputElement} The foreground color of this text (index into global color table) *///@ts-ignore element does exist in DOM
            foreground:document.getElementById("frameTextCharForeground"),
            /** @type {HTMLInputElement} The background color of this text (index into global color table) *///@ts-ignore element does exist in DOM
            background:document.getElementById("frameTextCharBackground")
        })
    }),
    /** Import menu */
    import:Object.freeze({
        /** @type {HTMLDialogElement} The import menu element (use this to open or close dialog box) *///@ts-ignore element does exist in DOM
        menu:document.getElementById("importMenu"),
        /** @type {HTMLInputElement} The URL input field (deactivate this if {@linkcode html.import.file} is used) *///@ts-ignore element does exist in DOM
        url:document.getElementById("importURL"),
        /** @type {HTMLInputElement} The file input field (deactivate this if {@linkcode html.import.url} is used) *///@ts-ignore element does exist in DOM
        file:document.getElementById("importFile"),
        /** @type {HTMLImageElement} The IMG preview of the imported GIF *///@ts-ignore element does exist in DOM
        preview:document.getElementById("importPreview"),
        /** @type {HTMLParagraphElement} Show warnings, errors, or other notes here *///@ts-ignore element does exist in DOM
        warn:document.getElementById("importWarn"),
        /** @type {HTMLInputElement} Button to confirm import, close {@linkcode html.import.menu}, and start decoding *///@ts-ignore element does exist in DOM
        confirm:document.getElementById("importConfirm"),
        /** @type {HTMLInputElement} Button to abort import and close {@linkcode html.import.menu} *///@ts-ignore element does exist in DOM
        abort:document.getElementById("importAbort")
    }),
    /** Confirm menu */
    confirm:Object.freeze({
        /** @type {HTMLDialogElement} The confirm menu element (use this to open or close dialog box) *///@ts-ignore element does exist in DOM
        menu:document.getElementById("confirmMenu"),
        /** @type {HTMLSpanElement} The text to confirm in the {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        text:document.getElementById("confirmText"),
        /** @type {HTMLInputElement} Button to confirm action and close {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        confirm:document.getElementById("confirmConfirm"),
        /** @type {HTMLInputElement} Button to abort action and close {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        abort:document.getElementById("confirmAbort")
    })
});

if(html.view.canvas==null)throw new Error("[GIF decoder] Couldn't get GIF canvas 2D context");
if(html.frame.canvas==null)throw new Error("[GIF decoder] Couldn't get frame canvas 2D context");

//~  _____              __ _                 ______ _       _
//~ /  __ \            / _(_)                |  _  (_)     | |
//~ | /  \/ ___  _ __ | |_ _ _ __ _ __ ___   | | | |_  __ _| | ___   __ _
//~ | |    / _ \| '_ \|  _| | '__| '_ ` _ \  | | | | |/ _` | |/ _ \ / _` |
//~ | \__/\ (_) | | | | | | | |  | | | | | | | |/ /| | (_| | | (_) | (_| |
//~  \____/\___/|_| |_|_| |_|_|  |_| |_| |_| |___/ |_|\__,_|_|\___/ \__, |
//~                                                                  __/ |
//~                                                                 |___/

const confirmDialog=Object.seal(new class ConfirmDialog{
    /** @type {((aborted:boolean)=>Promise<void>|void)|null} [Private] Current callback when dialog is closed (can be async) */
    static _callback_=null;
    /** @type {HTMLDialogElement} [Private] The dialog HTML element to open/close */
    static _dialog_;
    /** @type {HTMLSpanElement} [Private] The text HMTL element of {@linkcode _dialog_} to show a confirm message */
    static _title_;
    /** @type {HTMLInputElement} [Private] The confirm button HMTL element of {@linkcode _dialog_} */
    static _confirm_;
    /** @type {HTMLInputElement} [Private] The abort button HMTL element of {@linkcode _dialog_} */
    static _abort_;
    /** @type {boolean} [Private] If a dialog is currently still pending (can't open another one) */
    static _running_=false;
    /** @type {boolean} If a dialog is currently still pending (can't open another one) */
    get Running(){return ConfirmDialog._running_;}
    /**
     * ## Initializes {@linkcode ConfirmDialog} object
     * @param {HTMLDialogElement} dialog - the confirm HMTL dialog element
     * @param {HTMLSpanElement} text - the HTML text element of {@linkcode dialog} to show a confirm message
     * @param {HTMLInputElement} confirm - the confirm button of {@linkcode dialog}
     * @param {HTMLInputElement} abort - the abort button of {@linkcode dialog}
     */
    constructor(dialog,text,confirm,abort){
        ConfirmDialog._title_=text;
        ConfirmDialog._dialog_=dialog;
        ConfirmDialog._confirm_=confirm;
        ConfirmDialog._abort_=abort;
        ConfirmDialog._dialog_.addEventListener("cancel",async ev=>{"use strict";ev.preventDefault();ConfirmDialog._abort_.click();},{passive:false});
        ConfirmDialog._confirm_.addEventListener("click",async()=>ConfirmDialog._exit_(false),{passive:true});
        ConfirmDialog._abort_.addEventListener("click",async()=>ConfirmDialog._exit_(true),{passive:true});
    }
    /**
     * ## [Private, async] Called by an event listener when the dialog was closed
     * @param {boolean} aborted - if the dialog was aborted (`true`) or confirmed (`false`)
     */
    static async _exit_(aborted){
        "use strict";
        ConfirmDialog._dialog_.close();
        const call=ConfirmDialog._callback_;
        ConfirmDialog._callback_=null;
        ConfirmDialog._running_=false;
        await call?.(aborted);
    };
    /**
     * ## Shows a dialog that displays the {@linkcode action} to confirm
     * check if another dialog is still pending via {@linkcode Running}
     * @param {string} action - the action to confirm
     * @param {(aborted:boolean)=>Promise<void>|void} callback - a (strict, passive, optionally async) function, called when the {@linkcode action} was confirmed (param `false`) or aborted (param `true`)
     * @throws {Error} if another dialog is still pending
     */
    Setup(action,callback){
        if(ConfirmDialog._running_)throw new Error("[ConfirmDialog:setup] another dialog is still pending");
        ConfirmDialog._title_.textContent=action;
        ConfirmDialog._callback_=callback;
        ConfirmDialog._dialog_.showModal();
    }
    /**
     * ## Removes event listeners from `dialog`, `confirm`, and `abort` HTML elements (only call before deleting object)
     * check if a dialog is still pending via {@linkcode Running}
     * @param {boolean} [force] - [Optional] if `true` forces a pending dialog to abort
     * @throws {TypeError} if {@linkcode force} is set, but not a boolean
     * @throws {Error} if a dialog is still pending
     */
    static async RemoveListeners(force){
        if(force!=null&&typeof force!=="boolean")throw new TypeError("[ConfirmDialog:RemoveListeners] force is not a boolean");
        if(force==null||!force){
            if(ConfirmDialog._running_)throw new Error("[ConfirmDialog:setup] a dialog is still pending");
        }else await ConfirmDialog._exit_(true);
        ConfirmDialog._dialog_.removeEventListener("cancel",async ev=>{"use strict";ev.preventDefault();ConfirmDialog._abort_.click();});
        ConfirmDialog._confirm_.removeEventListener("click",async()=>ConfirmDialog._exit_(false));
        ConfirmDialog._abort_.removeEventListener("click",async()=>ConfirmDialog._exit_(true));
    }
}(html.confirm.menu,html.confirm.text,html.confirm.confirm,html.confirm.abort));

//~  _   _______ _        ___                                       _
//~ | | | | ___ \ |      / _ \                                     | |
//~ | | | | |_/ / |     / /_\ \_ __ __ _ _   _ _ __ ___   ___ _ __ | |_ ___
//~ | | | |    /| |     |  _  | '__/ _` | | | | '_ ` _ \ / _ \ '_ \| __/ __|
//~ | |_| | |\ \| |____ | | | | | | (_| | |_| | | | | | |  __/ | | | |_\__ \
//~  \___/\_| \_\_____/ \_| |_/_|  \__, |\__,_|_| |_| |_|\___|_| |_|\__|___/
//~                                 __/ |
//~                                |___/

// TODO implement

/**
 * URL parameters
 *
 * - if, during decoding, an error occurs, it will show the import menu and display the error without further decoding/rendering (ignore all parameters, except for collapsible areas)
 * - if {@linkcode urlParam.import} is given only allow {@linkcode urlParam.url} (paste into URL field and preview GIF) and collapsable areas (ignore all other parameters)
 *   - When the import menu is open, the GIF is not yet decoded (only a preview is shown)
 * - if {@linkcode urlParam.gifReal} and {@linkcode urlParam.frameReal} are both `false` ignore {@linkcode urlParam.pos} and {@linkcode urlParam.zoom}
 * - if {@linkcode urlParam.gifFull} is `true` ignore {@linkcode urlParam.frameFull}
 * - if {@linkcode urlParam.frameFull} is `true` ignore {@linkcode urlParam.frameView} (always expand {@linkcode html.details.frameView})
 * - if {@linkcode urlParam.frameView} is `false` ignore {@linkcode urlParam.frameReal} and {@linkcode urlParam.frameSmooth}
 * - if {@linkcode urlParam.pos} and {@linkcode urlParam.zoom} are given, apply {@linkcode urlParam.pos} before {@linkcode urlParam.zoom}
 */
const urlParam=(()=>{
    "use strict";
    const args=new URLSearchParams(window.location.search);
    let tmpNum=NaN;
    return Object.freeze({
        /**
         * GIF URL to load - default `null` → use the URL of this public domain GIF from Wikimedia:
         *
         * [![Wax_fire.gif](https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif)](https://commons.wikimedia.org/wiki/File:Wax_fire.gif "Open file info page on Wikimedia Commons")
         */
        url:args.get("url"),
        /** If the {@linkcode html.details.gifInfo} should be expanded - default `1` (expanded) */
        gifInfo:(args.get("gifInfo")??"1")!=="0",
        /** If the {@linkcode html.details.globalColorTable} should be expanded - default `1` (expanded) */
        globalColorTable:(args.get("globalColorTable")??"1")!=="0",
        /** If the {@linkcode html.details.appExtList} should be expanded - default `1` (expanded) */
        appExtList:(args.get("appExtList")??"1")!=="0",
        /** If the {@linkcode html.details.commentsList} should be expanded - default `0` (collapsed) */
        commentsList:(args.get("commentsList")??"0")!=="0",
        /** If the {@linkcode html.details.unExtList} should be expanded - default `0` (collapsed) */
        unExtList:(args.get("unExtList")??"0")!=="0",
        /** If the {@linkcode html.details.frameView} should be expanded - default `0` (collapsed) */
        frameView:(args.get("frameView")??"0")!=="0",
        /** If the {@linkcode html.details.frameInfo} should be expanded - default `0` (collapsed) */
        frameInfo:(args.get("frameInfo")??"0")!=="0",
        /** If the {@linkcode html.details.localColorTable} should be expanded - default `1` (expanded) */
        localColorTable:(args.get("localColorTable")??"1")!=="0",
        /** If the {@linkcode html.details.frameText} should be expanded - default `0` (collapsed) */
        frameText:(args.get("frameText")??"0")!=="0",
        /** If the {@linkcode html.import.menu} should be opened - default `0` (closed) */
        import:(args.get("import")??"0")!=="0",
        /** If the GIF should be playing - default `0` (paused) */
        play:(args.get("play")??"0")!=="0",
        /** The frame index (zero-based) to start with (if out of bounds use first frame) - default `0` (first frame) */
        f:Number.isSafeInteger(tmpNum=Number(args.get("f")))&&tmpNum>=0?tmpNum:0,
        /** If the {@linkcode html.userInput.userInputLock} should be toggled on - default `0` (OFF) */
        userLock:(args.get("userLock")??"0")!=="0",
        /** If the {@linkcode html.view.fullWindow} should be toggled on - default `0` (OFF) */
        gifFull:(args.get("gifFull")??"0")!=="0",
        /** If the {@linkcode html.view.fitWindow} should be toggled on - default `0` (OFF) */
        gifReal:(args.get("gifReal")??"0")!=="0",
        /** If the {@linkcode html.view.imgSmoothing} should be toggled on - default `1` (ON) */
        gifSmooth:(args.get("gifSmooth")??"1")!=="0",
        /** If the {@linkcode html.frame.fullWindow} should be toggled on - default `0` (OFF) */
        frameFull:(args.get("frameFull")??"0")!=="0",
        /** If the {@linkcode html.frame.fitWindow} should be toggled on - default `0` (OFF) */
        frameReal:(args.get("frameReal")??"0")!=="0",
        /** If the {@linkcode html.frame.imgSmoothing} should be toggled on - default `1` (ON) */
        frameSmooth:(args.get("frameSmooth")??"1")!=="0",
        /** The position/offset of {@linkcode html.view.htmlCanvas} ([left,top] safe integers) - default `[0,0]` (origin) */
        pos:Object.freeze(args.get("pos")?.match(/^(0|[1-9][0-9]*),(0|[1-9][0-9]*)$/)?.slice(1,3).map(v=>Number.isSafeInteger(tmpNum=Number(v))?tmpNum:0)??[0,0]),
        /**
         * The starting zoom of {@linkcode html.view.htmlCanvas} (safe integer) - default `0` (no zoom)
         *
         * Cap to (+-) half of GIF width (floored)
         */
        zoom:Number.isSafeInteger(tmpNum=Number(args.get("zoom")))?tmpNum:0
    });
})();

//~  _   _ _   _ _ _ _            __                  _   _
//~ | | | | | (_) (_) |          / _|                | | (_)
//~ | | | | |_ _| |_| |_ _   _  | |_ _   _ _ __   ___| |_ _  ___  _ __  ___
//~ | | | | __| | | | __| | | | |  _| | | | '_ \ / __| __| |/ _ \| '_ \/ __|
//~ | |_| | |_| | | | |_| |_| | | | | |_| | | | | (__| |_| | (_) | | | \__ \
//~  \___/ \__|_|_|_|\__|\__, | |_|  \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
//~                       __/ |
//~                      |___/

/**
 * ## Checks if the given {@linkcode url} leads to a GIF file
 * _async function_
 * @param {string} url - a URL that leads to a GIF file
 * @returns {Promise<boolean>} `true` if {@linkcode url} has MIME type `image/gif` and `false` otherwise
 */
const checkImageURL=async url=>{
    "use strict";
    if(url.startsWith("javascript:"))return false;
    if(url.startsWith("data:")){
        if(url.startsWith("data:image/gif"))return true;
        return false;
    }
    const res=await fetch(url,{method:"HEAD"}).catch(()=>null);
    const buff=await res?.blob();
    return buff?.type?.startsWith("image/gif")??false;
};

/**
 * ## Imports a GIF automatically and renders the first frame (paused - without showing {@linkcode html.import.menu})
 * _async function_
 * @param {string} url - a URL that leads to a GIF file
 * @returns {Promise<boolean>} `true` if the GIF was successfully loaded and `false` otherwise (shows {@linkcode html.import.menu} for error feedback)
 */
const silentImportGIF=async url=>{
    "use strict";
    await new Promise(E=>{
        "use strict";
        html.import.preview.addEventListener("load",E,{passive:true,once:true});
        html.import.url.value=url;
        html.import.url.dispatchEvent(new InputEvent("change"));
    });
    if(html.import.confirm.disabled){html.import.menu.showModal();return false;}
    html.import.confirm.click();
    return true;
};

/**
 * ## Copies own `value` to the clipboard and prevents default behaviour
 * (_use this for click events on color input fields to copy its hex code without showing the color input dialogue_)
 * @this {HTMLInputElement} `<input type="color">`
 * @param {MouseEvent} ev - `click` event
 */
const copyHexColorToClipboard=function(ev){
    "use strict";
    ev.preventDefault();
    navigator.clipboard.writeText(this.value).catch(reason=>console.warn("Couldn't copy color %s, reason: %O",this.value,reason));
}

/**
 * ## Set canvas offset position (in pixel)
 * default: recalculate position
 * @param {CSSStyleDeclaration} canvasStyle - {@linkcode html.view.canvasStyle} or {@linkcode html.frame.canvasStyle} depending on context
 * @param {number} [left] - new left offset in pixel
 * @param {number} [top] - new top offset in pixel
 */
const setCanvasOffset=(canvasStyle,left,top)=>{
    "use strict";
    if(left==null)left=Number.parseInt(html.root.style.getPropertyValue("--offset-view-left"));
    if(top==null)top=Number.parseInt(html.root.style.getPropertyValue("--offset-view-top"));
    const width=Number.parseFloat(canvasStyle.width),
        height=Number.parseFloat(canvasStyle.height);
    html.root.style.setProperty("--offset-view-left",`${Math.trunc(Math.max(width*-.5,Math.min(width*.5,left)))}px`);
    html.root.style.setProperty("--offset-view-top",`${Math.trunc(Math.max(height*-.5,Math.min(height*.5,top)))}px`);
};

/**
 * Adds `'` as digit seperator every 3 digits (from the right)
 * @param {number} num - an integer
 * @param {number} [radix] - numerical base (integer from 2 to 36 inclusive) - default `10`
 * @returns {string} the formatted number (only uppercase letters if any) - if {@linkcode num} is not an integer or it overflows into scientific notation (only possible with {@linkcode radix} `10`) it does not format the number an returns it as is
 */
const formatInt=(num,radix)=>{
    "use strict";
    radix??=0xA;
    let n=num.toString(radix).toUpperCase();
    if(!Number.isInteger(num)||(radix===0xA&&n.includes('E')))return n;
    const offset=n.length%3;
    for(let i=offset===0?3:offset;i<n.length;i+=4)n=`${n.substring(0,i)}'${n.substring(i)}`;
    return n;
};

/**
 * ## Computes the greatest-common-divisor of two whole numbers
 * @param {number} a - positive safe integer
 * @param {number} b - positive safe integer
 * @returns {number} greatest-common-divisor (integer)
 * @example gcd(45, 100); //=> 5 → (45/5)/(100/5) → 9/20
 */
const gcd=(a,b)=>{
    "use strict";
    for([a,b]=a<b?[b,a]:[a,b];a%b>0;[a,b]=[b,a%b]);
    return b;
}

/**
 * ## Generate the HTML for {@linkcode html.info.globalColorTable} ({@linkcode GIF.globalColorTable}) and {@linkcode html.frame.localColorTable} ({@linkcode Frame.localColorTable})
 * @param {[number,number,number][]} colorTable - global or local color table (list of `[R,G,B]`)
 * @param {boolean} global - if this is for the global color table (`true`) or the local color table (`false`)
 * @param {number|null} colorIndex - if {@linkcode global} is `true`, this is the background color index, otherwise the transparency index, into {@linkcode colorTable} (or `null` if not available)
 * @returns {[HTMLSpanElement]|HTMLLabelElement[]} the formatted list or a `<span>` representing an empty list
 */
const genHTMLColorGrid=(colorTable,global,colorIndex)=>{
    "use strict";
    if(colorTable.length===0){
        const span=document.createElement("span");
        span.textContent=`Empty list (see ${global?"global":"local"} color table)`;
        return[span];
    }
    return colorTable.map((color,i)=>{
        "use strict";
        const input=document.createElement("input"),
            label=document.createElement("label");
        input.type="color";
        input.value=color.reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"#");
        input.addEventListener("click",copyHexColorToClipboard,{passive:false});
        label.title=`Color index ${i} - click to copy hex code`;
        if(i===colorIndex)
            if(global){
                label.classList.add("background-flag");
                label.title+=" (used as background color)";
            }else{
                label.classList.add("transparent-flag");
                label.title+=" (color indicates transparency)";
            }
        label.append(`[${i}] `,input);
        return label;
    });
};
/**
 * ## Generate the HTML for {@linkcode html.info.appExtList} ({@linkcode GIF.applicationExtensions})
 * @param {ApplicationExtension[]} appExt - list of {@linkcode ApplicationExtension application extensions}
 * @returns {[HTMLSpanElement]|HTMLFieldSetElement[]} the formatted list or a `<span>` representing an empty list
 */
const genHTMLAppExtList=appExt=>{
    "use strict";
    if(appExt.length===0){
        const span=document.createElement("span");
        span.textContent="Empty list";
        return[span];
    }
    return appExt.map((ext,i)=>{
        "use strict";
        const legend=document.createElement("legend"),
            spanDesc=document.createElement("span"),
            input=document.createElement("input"),
            fieldset=document.createElement("fieldset");
        legend.title="Application-Extension identifier (8 characters) and authentication code (3 characters)";
        legend.textContent=`#${i} ${ext.identifier}${ext.authenticationCode}`;
        spanDesc.title="Description";
        switch(ext.identifier+ext.authenticationCode){
            case"NETSCAPE2.0":spanDesc.textContent=`loops the GIF ${(loop=>loop===0?"0 (infinite)":loop.toString(0xA))(ext.data[1]+(ext.data[2]<<8))} times`;break;
            default:spanDesc.textContent="unknown application extension";break;
        }
        input.type="button";
        input.title="Click to copy raw binary to clipboard";
        input.value="Copy raw binary";
        input.addEventListener("click",()=>{
            "use strict";
            //// const text=ext.data.reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"0x");
            const text=ext.data.reduce((o,v)=>o+String.fromCharCode(v),"");
            navigator.clipboard.writeText(text).catch(reason=>console.warn("Couldn't copy %i Bytes of text, reason: %O",text.length,reason));
        },{passive:true});
        fieldset.append(legend,spanDesc," ",input);
        return fieldset;
    });
};
/**
 * ## Generate the HTML for {@linkcode html.info.commentsList} ({@linkcode GIF.comments})
 * @param {[string,string][]} comments - list of comments and were they where found (`[<area found>,<comment>]`)
 * @returns {[HTMLSpanElement]|HTMLDivElement[]} the formatted list or a `<span>` representing an empty list
 */
const genHTMLCommentList=comments=>{
    "use strict";
    if(comments.length===0){
        const span=document.createElement("span");
        span.textContent="Empty list";
        return[span];
    }
    return comments.map((comment,i)=>{
        "use strict";
        const textarea=document.createElement("textarea"),
            div=document.createElement("div");
        textarea.readOnly=true;
        textarea.textContent=comment[1];
        div.title=`Comment #${i} found in GIF file at ${comment[0]}`;
        div.append(`#${i} at ${comment[0]}`,textarea);
        return div;
    });
};
/**
 * ## Generate the HTML for {@linkcode html.info.unExtList} ({@linkcode GIF.unknownExtensions})
 * @param {[number,Uint8Array][]} unExt - list of unknown extensions found (`[<identifier>,<raw bytes>]`)
 * @returns {[HTMLSpanElement]|HTMLDivElement[]} the formatted list or a `<span>` representing an empty list
 */
const getHTMLUnExtList=unExt=>{
    "use strict";
    if(unExt.length===0){
        const span=document.createElement("span");
        span.textContent="Empty list";
        return[span];
    }
    return unExt.map((ext,i)=>{
        "use strict";
        const input=document.createElement("input"),
            small=document.createElement("small"),
            span=document.createElement("span"),
            div=document.createElement("div");
        input.type="button";
        input.title="Click to copy raw binary to clipboard";
        input.value="Copy raw binary";
        input.addEventListener("click",()=>{
            "use strict";
            //// const text=ext[1].reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"0x");
            const text=ext[1].reduce((o,v)=>o+String.fromCharCode(v),"");
            navigator.clipboard.writeText(text).catch(reason=>console.warn("Couldn't copy %i Bytes of text, reason: %O",text.length,reason));
        },{passive:true});
        small.textContent=`(0x${ext[0].toString(0x10).toUpperCase().padStart(2,'0')})`;
        span.append(`#${i} ${String.fromCharCode(ext[0])} `,small);
        div.title="(Unknown) Extension identifier (1 character)";
        div.append(span,input);
        return div;
    });
}

/**
 * ## Update all values in {@linkcode html.info}
 * call once when GIF is loaded
 * @param {GIF} gif - current GIF object
 * @param {string} fileName - the file name of the current GIF
 */
const updateGifInfo=(gif,fileName)=>{
    html.info.fileName.textContent=fileName;
    html.info.totalWidth.textContent=String(gif.width);
    html.info.totalHeight.textContent=String(gif.height);
    html.info.totalFrames.textContent=String(gif.frames.length);
    html.info.totalTime.textContent=gif.totalTime===Infinity?"Infinity (waits for user input)":`${gif.totalTime} ms`;
    if(gif.pixelAspectRatio===0||gif.pixelAspectRatio===1)html.info.pixelAspectRatio.textContent="1:1 (square pixels)";
    else{
        const fracGCD=0x40/gcd(gif.pixelAspectRatio*0x40,0x40);
        html.info.pixelAspectRatio.textContent=`${gif.pixelAspectRatio*fracGCD}:${fracGCD} (${gif.pixelAspectRatio}:1)`;
    }
    html.info.colorRes.textContent=`${gif.colorRes} bits`;
    html.info.globalColorTable.replaceChildren(...genHTMLColorGrid(gif.globalColorTable,true,gif.backgroundColorIndex));
    html.info.appExtList.replaceChildren(...genHTMLAppExtList(gif.applicationExtensions));
    html.info.commentsList.replaceChildren(...genHTMLCommentList(gif.comments));
    html.info.unExtList.replaceChildren(...getHTMLUnExtList(gif.unknownExtensions));
};
/**
 * ## Initializes {@linkcode html.frameTime} with values (0 ms / frame 0)
 * call once when GIF is loaded
 * @param {GIF} gif - current GIF object
 * @returns {number} the sum of all frame delays (not counting infinities)
 */
const updateTimeInfoInit=gif=>{
    "use strict";
    let timeSum=0;
    html.frameTime.timeTickmarks.replaceChildren(...gif.frames.map((v,j)=>{
        const option=document.createElement("option");
        option.title=`Frame [${j}]`;
        option.text=String(timeSum);
        timeSum+=v.delayTime;
        return option;
    }));
    html.frameTime.timeRange.max=String(timeSum);
    html.frameTime.frameRange.max=String(gif.frames.length-1);
    return timeSum;
};
/**
 * ## Update all values in {@linkcode html.frame}
 * call at beginning of each frame
 * @param {GIF} gif - current GIF object
 * @param {number} i - current frame index
 */
const updateFrameInfo=(gif,i)=>{
    "use strict";
    const f=gif.frames[i];
    html.frame.canvas.putImageData(f.image,f.left,f.top);
    html.frame.width.textContent=String(f.width);
    html.frame.height.textContent=String(f.height);
    html.frame.left.textContent=String(f.left);
    html.frame.top.textContent=String(f.top);
    html.frame.time.textContent=`${f.delayTime} ms`;
    html.frame.userInputFlag.checked=f.userInputDelayFlag;
    html.frame.disposalMethod.replaceChildren(...(()=>{switch(f.disposalMethod){
        case 0:return["[0 unspecified]",document.createElement("br"),"replaces entire frame"];
        case 1:return["[1 do not dispose]",document.createElement("br"),"combine with previous frame"];
        case 2:return["[2 restore to background]",document.createElement("br"),"combine with background (first frame)"];
        case 3:return["[3 restore to previous]",document.createElement("br"),"restore to previous undisposed frame state then combine"];
        case 4:return["[4 undefined]",document.createElement("br"),"(fallback to 0) replaces entire frame"];
        case 5:return["[5 undefined]",document.createElement("br"),"(fallback to 0) replaces entire frame"];
        case 6:return["[6 undefined]",document.createElement("br"),"(fallback to 0) replaces entire frame"];
        case 7:return["[7 undefined]",document.createElement("br"),"(fallback to 0) replaces entire frame"];
        default:return["ERROR"];
    }})());
    html.frame.frameReserved.textContent=`${f.reserved} (0b${f.reserved.toString(2).padStart(2,'0')})`;
    html.frame.frameGCReserved.textContent=`${f.GCreserved} (0b${f.GCreserved.toString(2).padStart(3,'0')})`;
    html.frame.localColorTable.replaceChildren(...genHTMLColorGrid(f.localColorTable,false,f.transparentColorIndex));
    if(!html.frame.text.area.classList.toggle("empty",f.plainTextData==null)){
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.text.textContent=f.plainTextData.text;
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.grid.width.textContent=String(f.plainTextData.width);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.grid.height.textContent=String(f.plainTextData.height);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.grid.left.textContent=String(f.plainTextData.left);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.grid.top.textContent=String(f.plainTextData.top);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.cell.width.textContent=String(f.plainTextData.charWidth);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.cell.height.textContent=String(f.plainTextData.charHeight);
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.foreground.value=gif.globalColorTable[f.plainTextData.foregroundColor].reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"#");
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.background.value=gif.globalColorTable[f.plainTextData.backgroundColor].reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"#");
    }
};
/**
 * ## Update all values of {@linkcode html.frameTime} (except {@linkcode html.frameTime.timeTickmarks}) and {@linkcode html.userInput} (if {@linkcode Frame.userInputDelayFlag} is given and {@linkcode html.userInput.userInputLock} is OFF)
 * call each frame (before {@linkcode updateTimeInfo})
 * @param {GIF} gif - current GIF object
 * @param {number} i - current frame index
 * @param {number} ft - frame time in milliseconds (time when frame started)
 * @param {number} t - current time in milliseconds
 */
const updateTimeInfoFrame=(gif,i,ft,t)=>{
    "use strict";
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(t));
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(i));
    if(html.userInput.userInputArea.classList.toggle("waiting",html.userInput.userInputLock.dataset.toggle==="0"&&gif.frames[i].userInputDelayFlag)){
        if(html.userInput.userInputArea.classList.toggle("infinity",gif.frames[i].delayTime===0)){
            html.userInput.userInputTimeoutTime.textContent="∞";
            html.userInput.userInputTimeout.removeAttribute("value");
        }else html.userInput.userInputTimeoutTime.textContent=`-${(html.userInput.userInputTimeout.max=gif.frames[i].delayTime)-(html.userInput.userInputTimeout.value=t-ft)}`;
    }else{
        html.userInput.userInputArea.classList.toggle("infinity",false);
        html.userInput.userInputTimeoutTime.textContent="-";
        html.userInput.userInputTimeout.value=0;
    }
};
/**
 * ## Update all values of {@linkcode html.frameTime} (except {@linkcode html.frameTime.timeTickmarks}) and {@linkcode html.userInput}
 * call for every time step
 * @param {number} i - current frame index
 * @param {number} dt - frame delay time in milliseconds
 * @param {number} ft - frame time in milliseconds (time when frame started)
 * @param {number} t - current time in milliseconds
 */
const updateTimeInfo=(i,dt,ft,t)=>{
    "use strict";
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(t));
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(i));
    if(html.userInput.userInputArea.classList.contains("waiting")&&!html.userInput.userInputArea.classList.contains("infinity"))html.userInput.userInputTimeoutTime.textContent=`-${(html.userInput.userInputTimeout.max=dt)-(html.userInput.userInputTimeout.value=t-ft)}`;
};

//~  _____      _
//~ /  ___|    | |
//~ \ `--.  ___| |_ _   _ _ __
//~  `--. \/ _ \ __| | | | '_ \
//~ /\__/ /  __/ |_| |_| | |_) |
//~ \____/ \___|\__|\__,_| .__/
//~                      | |
//~                      |_|

html.view.canvas.imageSmoothingEnabled=false;
html.frame.canvas.imageSmoothingEnabled=false;

html.root.style.setProperty("--offset-view-left","0px");
html.root.style.setProperty("--offset-view-top","0px");
html.root.style.setProperty("--canvas-width","0px");
html.root.style.setProperty("--canvas-scaler","1.0");

/** Global variables (sealed object) */
const global=Object.seal({// TODO ? JSDoc
    /** @type {GIF} *///@ts-ignore better to throw an error when it's unexpectedly still null than have ?. everywhere
    gifDecode:null,
    frameIndex:0,
    lastFullCanvas:new OffscreenCanvas(1,1),
    /** @type {OffscreenCanvasRenderingContext2D} *///@ts-ignore better to throw an error when it's unexpectedly still null than have ?. everywhere
    lastFullContext:null,
    lastFullIndex:0,
    dragging:false,
    /** if `true` dragging is from {@linkcode html.view.view} and when `false` from {@linkcode html.frame.view} */
    draggingGIF:true,
    mouseX:0,
    mouseY:0,
    scaler:0
});
//@ts-ignore better to throw an error when it's unexpectedly null than have ?. everywhere
global.lastFullContext=global.lastFullCanvas.getContext("2d");

//~  _   _ _                                 _             _
//~ | | | (_)                               | |           | |
//~ | | | |_  _____      __   ___ ___  _ __ | |_ _ __ ___ | |___
//~ | | | | |/ _ \ \ /\ / /  / __/ _ \| '_ \| __| '__/ _ \| / __|
//~ \ \_/ / |  __/\ V  V /  | (_| (_) | | | | |_| | | (_) | \__ \
//~  \___/|_|\___| \_/\_/    \___\___/|_| |_|\__|_|  \___/|_|___/

//~ view buttons full-window mode / fit to window (or pan & zoom controls) / img smoothing

html.view.fullWindow.addEventListener("click",()=>{
    "use strict";
    if((html.view.fullWindow.dataset.toggle??"0")==="0"){
        html.view.fullWindow.dataset.toggle="1";
        html.view.fullWindow.value="🗙";
        html.view.view.classList.add("full");
        html.box.insertAdjacentElement("beforebegin",html.view.view);
    }else{
        html.view.fullWindow.dataset.toggle="0";
        html.view.fullWindow.value="⤢";
        html.view.view.classList.remove("full");
        html.heading.insertAdjacentElement("afterend",html.view.view);
    }
},{passive:true});
html.frame.fullWindow.addEventListener("click",()=>{
    "use strict";
    if((html.frame.fullWindow.dataset.toggle??"0")==="0"){
        html.frame.fullWindow.dataset.toggle="1";
        html.frame.fullWindow.value="🗙";
        html.frame.view.classList.add("full");
        html.box.insertAdjacentElement("beforebegin",html.frame.view);
    }else{
        html.frame.fullWindow.dataset.toggle="0";
        html.frame.fullWindow.value="⤢";
        html.frame.view.classList.remove("full");
        html.details.frameView.insertAdjacentElement("beforeend",html.frame.view);
    }
},{passive:true});

html.view.fitWindow.addEventListener("click",()=>{
    "use strict";
    if((html.view.fitWindow.dataset.toggle??"0")==="0"){
        html.view.fitWindow.dataset.toggle="1";
        html.view.fitWindow.value="🞑";
        html.view.htmlCanvas.classList.add("real");
        html.view.view.title="Drag with left mouse button to move image, reset position with double left click, zoom with mouse wheel (faster with shift and slower with alt), and reset zoom by clicking the mouse wheel";
        html.root.style.setProperty("--canvas-width",`${html.view.htmlCanvas.width}px`);
    }else{
        html.view.fitWindow.dataset.toggle="0";
        html.view.fitWindow.value="🞕";
        html.view.htmlCanvas.classList.remove("real");
        html.view.view.title="GIF render canvas";
    }
},{passive:true});
html.frame.fitWindow.addEventListener("click",()=>{
    "use strict";
    if((html.frame.fitWindow.dataset.toggle??"0")==="0"){
        html.frame.fitWindow.dataset.toggle="1";
        html.frame.fitWindow.value="🞑";
        html.frame.htmlCanvas.classList.add("real");
        html.frame.view.title="Drag with left mouse button to move image, reset position with double left click, zoom with mouse wheel (faster with shift and slower with alt), and reset zoom by clicking the mouse wheel";
        html.root.style.setProperty("--canvas-width",`${html.frame.htmlCanvas.width}px`);
    }else{
        html.frame.fitWindow.dataset.toggle="0";
        html.frame.fitWindow.value="🞕";
        html.frame.htmlCanvas.classList.remove("real");
        html.frame.view.title="Frame render canvas";
    }
},{passive:true});

//~ canvas context2d imageSmoothingEnabled (true) and imageSmoothingQuality (low medium high) are only for drawn images that are distorted or scaled, but since here the GIF is rendered at native resolution (within the canvas) the only smooth/sharp that is possible is via CSS image-rendering
html.view.imgSmoothing.addEventListener("click",()=>{
    "use strict";
    if((html.view.imgSmoothing.dataset.toggle??"1")==="0"){
        html.view.imgSmoothing.dataset.toggle="1";
        html.view.imgSmoothing.value="🙼";
        html.view.htmlCanvas.classList.remove("pixel");
    }else{
        html.view.imgSmoothing.dataset.toggle="0";
        html.view.imgSmoothing.value="🙾";
        html.view.htmlCanvas.classList.add("pixel");
    }
},{passive:true});
html.frame.imgSmoothing.addEventListener("click",()=>{
    "use strict";
    if((html.frame.imgSmoothing.dataset.toggle??"1")==="0"){
        html.frame.imgSmoothing.dataset.toggle="1";
        html.frame.imgSmoothing.value="🙼";
        html.frame.htmlCanvas.classList.remove("pixel");
    }else{
        html.frame.imgSmoothing.dataset.toggle="0";
        html.frame.imgSmoothing.value="🙾";
        html.frame.htmlCanvas.classList.add("pixel");
    }
},{passive:true});

//~ canvas (syncronised) pan and zoom controls

//~ dragging
document.addEventListener("mousedown",ev=>{
    "use strict";
    if(ev.button!==0||!(
        ((ev.target===html.view.view||ev.target===html.view.htmlCanvas)&&(html.view.fitWindow.dataset.toggle??"0")==="1")
        ||((ev.target===html.frame.view||ev.target===html.frame.htmlCanvas)&&(html.frame.fitWindow.dataset.toggle??"0")==="1")
    ))return;
    global.mouseX=ev.clientX;
    global.mouseY=ev.clientY;
    global.dragging=true;
    global.draggingGIF=ev.target===html.view.view||ev.target===html.view.htmlCanvas;
    document.documentElement.classList.add("grabbing");
    ev.preventDefault();
},{passive:false});
document.addEventListener("mousemove",ev=>{
    "use strict";
    if(!global.dragging)return;
    setCanvasOffset(
        global.draggingGIF?html.view.canvasStyle:html.frame.canvasStyle,
        Number.parseInt(html.root.style.getPropertyValue("--offset-view-left"))+(ev.clientX-global.mouseX),
        Number.parseInt(html.root.style.getPropertyValue("--offset-view-top"))+(ev.clientY-global.mouseY)
    );
    global.mouseX=ev.clientX;
    global.mouseY=ev.clientY;
},{passive:true});
document.addEventListener("mouseup",()=>{
    "use strict";
    global.dragging=false;
    document.documentElement.classList.remove("grabbing");
},{passive:true});

//~ reset dragging
html.view.view.addEventListener("dblclick",ev=>{
    "use strict";
    if((html.view.fitWindow.dataset.toggle??"0")==="0")return;
    setCanvasOffset(html.view.canvasStyle,0,0);
    ev.preventDefault();
});
html.frame.view.addEventListener("dblclick",ev=>{
    "use strict";
    if((html.frame.fitWindow.dataset.toggle??"0")==="0")return;
    setCanvasOffset(html.frame.canvasStyle,0,0);
    ev.preventDefault();
});

//~ zoom
document.addEventListener("wheel",ev=>{
    "use strict";
    if(ev.ctrlKey||!(
        ((ev.target===html.view.view||ev.target===html.view.htmlCanvas)&&(html.view.fitWindow.dataset.toggle??"0")==="1")
        ||((ev.target===html.frame.view||ev.target===html.frame.htmlCanvas)&&(html.frame.fitWindow.dataset.toggle??"0")==="1")
    ))return;
    const previousWidth=Number.parseFloat(html.view.canvasStyle.width),
        previousHeight=Number.parseFloat(html.view.canvasStyle.height);
    html.root.style.setProperty("--canvas-scaler",String(
        Math.exp((
            global.scaler=Math.max(html.view.htmlCanvas.width*-.5,
                Math.min(html.view.htmlCanvas.width*.5,
                    global.scaler+(ev.deltaY*-(ev.shiftKey?.5:ev.altKey?.01:.1))
                )
            )
        )*.01)
    ));
    setCanvasOffset(
        (ev.target===html.view.view||ev.target===html.view.htmlCanvas)?html.view.canvasStyle:html.frame.canvasStyle,
        (Number.parseFloat(html.view.canvasStyle.width)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-left")))/previousWidth,
        (Number.parseFloat(html.view.canvasStyle.height)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-top")))/previousHeight
    );
    ev.preventDefault();
},{passive:false});

//~ reset zoom
html.view.view.addEventListener("mousedown",ev=>{
    "use strict";
    if(ev.button!==1||(html.view.fitWindow.dataset.toggle??"0")==="0")return;
    global.scaler=0;
    html.root.style.setProperty("--canvas-scaler","1");
    setCanvasOffset(html.view.canvasStyle);
    ev.preventDefault();
},{passive:false});
html.frame.view.addEventListener("mousedown",ev=>{
    "use strict";
    if(ev.button!==1||(html.frame.fitWindow.dataset.toggle??"0")==="0")return;
    global.scaler=0;
    html.root.style.setProperty("--canvas-scaler","1");
    setCanvasOffset(html.frame.canvasStyle);
    ev.preventDefault();
},{passive:false});

//~  _____                           _                          _
//~ |_   _|                         | |                        | |
//~   | | _ __ ___  _ __   ___  _ __| |_    _____   _____ _ __ | |_ ___
//~   | || '_ ` _ \| '_ \ / _ \| '__| __|  / _ \ \ / / _ \ '_ \| __/ __|
//~  _| || | | | | | |_) | (_) | |  | |_  |  __/\ V /  __/ | | | |_\__ \
//~  \___/_| |_| |_| .__/ \___/|_|   \__|  \___| \_/ \___|_| |_|\__|___/
//~                | |
//~                |_|

html.open.addEventListener("click",()=>html.import.menu.showModal(),{passive:true});

html.import.abort.addEventListener("click",()=>html.import.menu.close(),{passive:true});

html.import.url.addEventListener("change",async()=>{
    "use strict";
    const check=await checkImageURL(html.import.url.value);
    html.import.file.disabled=check;
    html.import.warn.textContent=check?"":"Given URL does not lead to a GIF image";
    html.import.preview.src=check?html.import.url.value:"";
    html.import.confirm.disabled=!check;
},{passive:true});
html.import.file.addEventListener("change",async()=>{
    "use strict";
    html.import.url.disabled=false;
    html.import.preview.src="";
    html.import.confirm.disabled=true;
    if(html.import.file.files==null||html.import.file.files.length===0){html.import.warn.textContent="No files selected";return;}
    if(html.import.file.files.length>1){html.import.warn.textContent="Please only select one file";return;}
    const version=await html.import.file.files[0].slice(0,6).text().then(null,reason=>{return{reason};}).catch(reason=>{return{reason};});
    if(typeof version==="object"){html.import.warn.textContent=`Error reading file: ${version.reason}`;return;}
    if(version!=="GIF89a"){html.import.warn.textContent="Provided file is not a suported GIF file (GIF89a)";return;}
    html.import.url.disabled=true;
    html.import.warn.textContent="";
    html.import.preview.src=URL.createObjectURL(html.import.file.files[0]);
    html.import.confirm.disabled=false;
},{passive:true});

html.import.confirm.addEventListener("click",async()=>{
    "use strict";
    const fileSrc=html.import.preview.src,
        fileName=html.import.url.disabled?html.import.file.files?.[0]?.name:html.import.url.value.match(/^[^#?]+?\/(.+?\.gif)(?:[#?]|$)/i)?.[0];
    html.import.menu.close();
    if(html.controls.container.classList.value!=="paused")html.controls.pause.click();
    html.loading.gif.classList.remove("done");
    html.loading.frame.classList.remove("done");
    html.loading.gifProgress.removeAttribute("value");
    html.loading.frameProgress.removeAttribute("value");
    html.loading.gifText.textContent="Loading...";
    html.loading.frameText.textContent="Loading...";
    decodeGIF(fileSrc,async(percentageRead,frameIndex,frame,framePos,gifSize)=>{
        "use strict";
        if(frameIndex===0){
            //~ only on first call
            if(html.view.fitWindow.dataset.toggle==="1")html.view.fitWindow.click();
            if(html.frame.fitWindow.dataset.toggle==="1")html.frame.fitWindow.click();
            html.frame.htmlCanvas.width=(html.view.htmlCanvas.width=gifSize[0]);
            html.frame.htmlCanvas.height=(html.view.htmlCanvas.height=gifSize[1]);
            html.view.canvas.clearRect(0,0,html.view.htmlCanvas.width,html.view.htmlCanvas.height);
            html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
        }
        html.loading.gifProgress.value=(html.loading.frameProgress.value=percentageRead);
        html.loading.gifText.textContent=(html.loading.frameText.textContent=`Frame ${String(frameIndex+1).padStart(2,'0')} | ${(percentageRead*0x64).toFixed(2).padStart(5,'0')}%`);
        html.view.canvas.clearRect(0,0,html.view.htmlCanvas.width,html.view.htmlCanvas.height);
        html.view.canvas.putImageData(frame,framePos[0],framePos[1]);
        if(html.details.frameView.open){
            html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
            html.frame.canvas.putImageData(frame,framePos[0],framePos[1]);
        }
        //~ wait for one cycle
        await new Promise(E=>setTimeout(E,0));
    }).then(gif=>{
        "use strict";
        global.gifDecode=gif;
        global.lastFullCanvas.width=gif.width;
        global.lastFullCanvas.height=gif.height;
        html.loading.gif.classList.add("done");
        html.loading.frame.classList.add("done");
        updateGifInfo(gif,fileName??"");
        updateTimeInfoInit(gif);
        updateFrameInfo(gif,0);
        updateTimeInfoFrame(gif,0,0,0);
        //~ render first frame to every canvas
        html.view.canvas.clearRect(0,0,html.view.htmlCanvas.width,html.view.htmlCanvas.height);
        html.view.canvas.putImageData(gif.frames[0].image,gif.frames[0].left,gif.frames[0].top);
        global.lastFullContext.clearRect(0,0,global.lastFullCanvas.width,global.lastFullCanvas.height);
        global.lastFullContext.drawImage(html.view.htmlCanvas,0,0);
        html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
        html.frame.canvas.putImageData(gif.frames[0].image,gif.frames[0].left,gif.frames[0].top);
    },reason=>{
        "use strict";
        html.import.warn.textContent=reason;
        html.import.menu.showModal();
        console.error("Error importing GIF: %s",reason);
    });
},{passive:true});

//~ ______ _             _                _                      _             _
//~ | ___ \ |           | |              | |                    | |           | |
//~ | |_/ / | __ _ _   _| |__   __ _  ___| | __   ___ ___  _ __ | |_ _ __ ___ | |___
//~ |  __/| |/ _` | | | | '_ \ / _` |/ __| |/ /  / __/ _ \| '_ \| __| '__/ _ \| / __|
//~ | |   | | (_| | |_| | |_) | (_| | (__|   <  | (_| (_) | | | | |_| | | (_) | \__ \
//~ \_|   |_|\__,_|\__, |_.__/ \__,_|\___|_|\_\  \___\___/|_| |_|\__|_|  \___/|_|___/
//~                 __/ |
//~                |___/

html.controls.seekStart.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});
html.controls.seekEnd.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});

html.controls.seekNext.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});
html.controls.seekPrevious.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});

html.controls.pause.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});

html.controls.play.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});
html.controls.reverse.addEventListener("click",()=>{
    "use strict";
    // TODO
},{passive:true});

html.userInput.userInputLock.addEventListener("click",()=>{
    "use strict";
    if((html.userInput.userInputLock.dataset.toggle??"0")==="0"){
        html.userInput.userInputLock.dataset.toggle="1";
        html.userInput.userInput.disabled=true;
    }else{
        html.userInput.userInputLock.dataset.toggle="0";
        html.userInput.userInput.disabled=false;
    }
},{passive:true});

//~ ___  ____                                 _
//~ |  \/  (_)                               | |
//~ | .  . |_ ___  ___    _____   _____ _ __ | |_ ___
//~ | |\/| | / __|/ __|  / _ \ \ / / _ \ '_ \| __/ __|
//~ | |  | | \__ \ (__  |  __/\ V /  __/ | | | |_\__ \
//~ \_|  |_/_|___/\___|  \___| \_/ \___|_| |_|\__|___/

html.frame.text.foreground.addEventListener("click",copyHexColorToClipboard,{passive:false});
html.frame.text.background.addEventListener("click",copyHexColorToClipboard,{passive:false});

//~  _____ ___________                      _
//~ |  __ \_   _|  ___|                    | |
//~ | |  \/ | | | |_     _ __ ___ _ __   __| | ___ _ __
//~ | | __  | | |  _|   | '__/ _ \ '_ \ / _` |/ _ \ '__|
//~ | |_\ \_| |_| |     | | |  __/ | | | (_| |  __/ |
//~  \____/\___/\_|     |_|  \___|_| |_|\__,_|\___|_|

(async c=>{// TODO remove
    "use strict";
    if(c)return;
    await new Promise(E=>setTimeout(E,0));
    html.details.frameInfo.toggleAttribute("open");
    await silentImportGIF("Wax_fire.gif");
})(false);

//! use `html.import.warn` for errors while decoding (see edge-cases of `urlParam`)

// TODO use animation frames and calculate timing for gif frames
// TODO edge-case: abort update-loop if previous and current animation frame timestamp is the same value
// TODO ~ log animation frame time ? calculate frame ~ loop or last frame
// TODO use async functions for rendering ~ immediatly call next animation frame while doing work async ~

// TODO ? remove queue
/** @type {(()=>any)[]} Function queue called when a GIF has finished loading, the first frame has been drawn, and playback is paused (functions get removed after call) */
const gifLoadQueue=Object.preventExtensions([()=>{
    "use strict";
    global.lastFullCanvas=new OffscreenCanvas(global.gifDecode.width,global.gifDecode.height);
    //@ts-ignore checked inline if this might yield null
    if((global.lastFullContext=global.lastFullCanvas.getContext("2d"))==null)throw new Error("[GIF decoder] Couldn't get offscreen canvas 2D context");
    global.lastFullContext.globalCompositeOperation="copy";
    global.lastFullContext.drawImage(html.view.htmlCanvas,0,0);
}]);

// TODO ! test edge-cases
(async()=>{//~ load URL parameters
    "use strict";
    html.details.gifInfo.toggleAttribute("open",urlParam.gifInfo);
    html.details.globalColorTable.toggleAttribute("open",urlParam.globalColorTable);
    html.details.appExtList.toggleAttribute("open",urlParam.appExtList);
    html.details.commentsList.toggleAttribute("open",urlParam.commentsList);
    html.details.frameView.toggleAttribute("open",(!urlParam.import&&!urlParam.gifFull&&urlParam.frameFull)||urlParam.frameView);
    html.details.frameInfo.toggleAttribute("open",urlParam.frameInfo);
    html.details.localColorTable.toggleAttribute("open",urlParam.localColorTable);
    html.details.frameText.toggleAttribute("open",urlParam.frameText);
    if(urlParam.import){
        //~ wait for one cycle
        await new Promise(E=>setTimeout(E,0));
        html.import.menu.showModal();
        if(urlParam.url!=null){
            html.import.url.value=urlParam.url;
            html.import.url.dispatchEvent(new Event("change"));
        }
        return;
    }
    // global.url=urlParam.url??"https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif";
    global.frameIndex=urlParam.f;
    if(urlParam.gifReal||((urlParam.frameView||(!urlParam.gifFull&&urlParam.frameFull))&&urlParam.frameReal))gifLoadQueue.push((canvasStyle=>async()=>{
        "use strict";
        //~ wait for one cycle
        await new Promise(E=>setTimeout(E,0));
        // TODO ↑ test if one cycle is enouth
        setCanvasOffset(canvasStyle,...urlParam.pos);
        //~ wait for one cycle
        await new Promise(E=>setTimeout(E,0));
        const previousWidth=Number.parseFloat(canvasStyle.width),
        previousHeight=Number.parseFloat(canvasStyle.height);
        html.root.style.setProperty("--canvas-scaler",String(
            Math.exp((
                global.scaler=Math.max(global.gifDecode.width*-.5,
                    Math.min(global.gifDecode.width*.5,
                        urlParam.zoom
                    )
                )
            )*.01)
        ));
        setCanvasOffset(
            canvasStyle,
            (Number.parseFloat(canvasStyle.width)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-left")))/previousWidth,
            (Number.parseFloat(canvasStyle.height)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-top")))/previousHeight
        );
    })(urlParam.gifReal?html.view.canvasStyle:html.frame.canvasStyle));
    if(urlParam.play)gifLoadQueue.push(()=>html.controls.play.click());
    //~ wait for one cycle
    await new Promise(E=>setTimeout(E,0));
    if(urlParam.gifFull)html.view.fullWindow.click();
    else if(urlParam.frameFull)html.frame.fullWindow.click();
    if(urlParam.gifReal)html.view.fitWindow.click();
    if(urlParam.frameReal)html.frame.fitWindow.click();
    if(!urlParam.gifSmooth)html.view.imgSmoothing.click();
    if(!urlParam.frameSmooth)html.frame.imgSmoothing.click();
    if(urlParam.userLock)html.userInput.userInputLock.click();
})();


throw 0;
// TODO ↓

/*
    const img=new ImageData(Uint8ClampedArray.of(1,0x7F,0xFF,0xFF),1,1,{colorSpace:"srgb"});
    // replace pixels on canvas with image (incl. alpha)
    ctx.putImageData(img,0,0);
    // add image pixels to canvas (add alpha)
    ctx.drawImage(await createImageBitmap(img),0,0);
*/

let frameMemoryUsage=0;

const forceClearLastFrame=true,
    alertErrors=true,
    gifURL="https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif";

decodeGIF(gifURL,async(percentageRead,frameCount,frameUpdate,framePos,gifSize)=>{
    progressBar.value=percentageRead;
    ctx.drawImage(await createImageBitmap(frameUpdate),(canvas.width-gifSize[0])*.5+framePos[0],(canvas.height-gifSize[1])*.5+framePos[1]);
    frameMemoryUsage+=frameUpdate.data.length;
    const text=`frame ${formatInt(frameCount)} (${formatInt(frameMemoryUsage)} Bytes)`,
        textMet=ctx.measureText(text),
        textpos=[(canvas.width-textMet.width)*.5,canvas.height*.5-(textMet.actualBoundingBoxAscent+textMet.actualBoundingBoxDescent)];
    ctx.strokeStyle="white";
    ctx.lineWidth=1.2;
    ctx.strokeText(text,textpos[0],textpos[1],gifSize[0]);
    ctx.lineWidth=1;
    ctx.fillStyle="black";
    ctx.fillText(text,textpos[0],textpos[1],gifSize[0]);
},false).then(async gif=>{
    progressBar.hidden=true;
    const offscreenCanvas=new OffscreenCanvas(gif.width,gif.height);
    const offscreenContext=offscreenCanvas.getContext("2d");
    if(offscreenContext==null)throw new Error("could not create offscreen canvas context");
    offscreenContext.imageSmoothingQuality="low";
    offscreenContext.imageSmoothingEnabled=false;
    offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
    let frameI=0,
        loopCount=getGIFLoopAmount(gif)??0;
    if(loopCount===0)loopCount=Infinity;
    // TODO modify to get perfect timing for each frame (now it's a little slower than viewing the GIF on its own)
    const update=async()=>{
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const pos=[(canvas.width-gif.width)*.5,(canvas.height-gif.height)*.5];
        const frame=gif.frames[frameI];
        // TODO when printing image account for > gif.pixelAspectRatio
        switch(frame.disposalMethod){
            case DisposalMethod.UndefinedA://! fall through
            case DisposalMethod.UndefinedB://! fall through
            case DisposalMethod.UndefinedC://! fall through
            case DisposalMethod.UndefinedD://! fall through
            case DisposalMethod.Replace:
                offscreenContext.drawImage(await createImageBitmap(frame.image),frame.left,frame.top);
                ctx.drawImage(offscreenCanvas,pos[0],pos[1]);
                offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
            break;
            case DisposalMethod.Combine:
                offscreenContext.drawImage(await createImageBitmap(frame.image),frame.left,frame.top);
                ctx.drawImage(offscreenCanvas,pos[0],pos[1]);
            break;
            case DisposalMethod.RestoreBackground:
                offscreenContext.drawImage(await createImageBitmap(frame.image),frame.left,frame.top);
                ctx.drawImage(offscreenCanvas,pos[0],pos[1]);
                offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
                if(gif.globalColorTable.length===0)offscreenContext.putImageData(gif.frames[0].image,pos[0]+frame.left,pos[1]+frame.top);
                else offscreenContext.putImageData(gif.backgroundImage,pos[0],pos[1]);
            break;
            case DisposalMethod.RestorePrevious:
                const previousImageData=offscreenContext.getImageData(0,0,offscreenCanvas.width,offscreenCanvas.height);
                offscreenContext.drawImage(await createImageBitmap(frame.image),frame.left,frame.top);
                ctx.drawImage(offscreenCanvas,pos[0],pos[1]);
                offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
                offscreenContext.putImageData(previousImageData,0,0);
            break;
        }
        if(++frameI>=gif.frames.length){
            if(--loopCount<=0)return;
            frameI=0;
            //? so apparently some GIFs seam to set the disposal method of the last frame wrong?...so this is a "fix" for that (clear after the last frame)
            if(forceClearLastFrame)offscreenContext.clearRect(0,0,offscreenCanvas.width,offscreenCanvas.height);
        }
        // TODO add a "press any key" when user input delay flag is set for this frame (and timeout when delay time is non-zero)
        setTimeout(update,gif.frames[frameI].delayTime);
    }
    setTimeout(update,0);
}).catch(err=>{
    console.error(err);
    if(alertErrors)alert(err?.message??err);
});
