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
    /**unspecified > do nothing with image*/Unspecified:0,
    /**do not dispose > keep image to next frame*/DoNotDispose:1,
    /**restore to background > frame area gets filled with background color (can be transparent)*/RestoreBackgroundColor:2,
    /**restore to previous > dispose frame data after rendering*/RestorePrevious:3,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedA:4,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedB:5,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedC:6,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedD:7,
});
/**
 * ## Decodes a GIF into its components for rendering on a canvas
 * @param {string} gifURL - the URL of a GIF file
 * @param {boolean} [avgAlpha] - if this is `true` then, when encountering a transparent pixel, it uses the average value of the pixels RGB channels to calculate the alpha channels value, otherwise alpha channel is either 0 or 1 - _default `false`_
 * @param {(percentageRead:number,frameIndex:number,frame:ImageData,framePos:[number,number],gifSize:[number,number])=>any} [progressCallback] - Optional callback for showing progress of decoding process (when GIF is interlaced calls after each pass (4x on the same frame)) - if asynchronous, it waits for it to resolve before continuing decoding
 * @param {(loaded:number,total:number|null)=>any} [fetchProgressCallback] - Optional callback for showing progress of fetching the image data (in bytes)
 * @returns {Promise<GIF>} the GIF with each frame decoded separately - may reject for the following reasons
 * - `fetch error` when trying to fetch the GIF from {@linkcode gifURL} (probably blocked by CORS security options)
 * - `fetch aborted` when trying to fetch the GIF from {@linkcode gifURL}
 * - `loading error [CODE]` when URL yields a status code that's NOT between 200 and 299 (inclusive)
 * - `not a supported GIF file` when GIF version is NOT `GIF89a`
 * - `error while parsing frame [INDEX] "ERROR"` while decoding GIF - one of the following
 * - - `GIF frame size is to large`
 * - - `plain text extension without global color table`
 * - - `undefined block found`
 * @throws {TypeError} if {@linkcode gifURL} is not a string, {@linkcode progressCallback} is given but not a function, or {@linkcode avgAlpha} is given but not a boolean
 */
const decodeGIF=async(gifURL,avgAlpha,progressCallback,fetchProgressCallback)=>{
    "use strict";
    if(typeof gifURL!=="string")throw new TypeError("[decodeGIF] gifURL is not a string");
    avgAlpha??=false;
    if(typeof avgAlpha!=="boolean")throw TypeError("[decodeGIF] avgAlpha is not a boolean");
    if(progressCallback!=null&&typeof progressCallback!=="function")throw new TypeError("[decodeGIF] progressCallback is not a function");
    if(fetchProgressCallback!=null&&typeof fetchProgressCallback!=="function")throw new TypeError("[decodeGIF] fetchProgressCallback is not a function");
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
                        await progressCallback?.((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),image,[frame.left,frame.top],[gif.width,gif.height]);
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
                    await progressCallback?.((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),frame.image=image,[frame.left,frame.top],[gif.width,gif.height]);
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
                        const pos=`[${byteStream.pos}] after ${getLastBlock()}`;
                        getLastBlock(`comment extension [${gif.comments.length}] at ${pos}`);
                        gif.comments.push([pos,byteStream.readSubBlocks()]);
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
                        //~ text character cell width (1B) - width (in pixels) of each cell (character) in text grid
                        plainTextData.charWidth=byteStream.nextByte();
                        //~ text character cell height (1B) - height (in pixels) of each cell (character) in text grid
                        plainTextData.charHeight=byteStream.nextByte();
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
        "use strict";
        const xhr=new XMLHttpRequest();
        xhr.responseType="arraybuffer";
        xhr.onprogress=ev=>{
            "use strict";
            fetchProgressCallback?.(ev.loaded,ev.lengthComputable?ev.total:null);
        };
        xhr.onload=async()=>{
            "use strict";
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
                            disposalMethod:DisposalMethod.Unspecified,
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
        xhr.open("GET",gifURL,true);
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
    /**
     * @type {HTMLElement} DOM root (`<html>`)
     * @description
     * CSS variables for pan and zoom controls:
     * - `--offset-view-left: 0px`
     * - `--offset-view-top: 0px`
     * - `--canvas-width: 0px`
     * - `--canvas-scaler: 1.0`)
     *
     * JS custom events when importing/loading GIF:
     * - `loadpreview` {@linkcode html.import.preview} loaded successfully from {@linkcode html.import.url} or {@linkcode html.import.file}
     * - `loadcancel` import was canceled from {@linkcode html.import.url} or {@linkcode html.import.file} (preview failed)
     * - `loadstart` import stared loading from {@linkcode html.import.confirm}
     * - `loadend` import finished and first frame was drawn
     * - `loaderror` import error and {@linkcode html.import.menu} shown
     */
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
        /** @type {CanvasRenderingContext2D} The main GIF canvas (2D context of {@linkcode html.view.htmlCanvas}) *///@ts-ignore element does exist in DOM - checked for null further below
        canvas:document.getElementById("htmlCanvas").getContext("2d",{colorSpace:"srgb"}),
        /** @type {HTMLDivElement} container for the {@linkcode html.view.htmlCanvas} controls *///@ts-ignore element does exist in DOM
        controls:document.getElementById("gifViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.view.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow:document.getElementById("fullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 fit to {@linkcode html.view.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow:document.getElementById("fitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 pixelated `🙾` (default) and 1 smooth `🙼` image rendering via class `smooth` *///@ts-ignore element does exist in DOM
        imgSmoothing:document.getElementById("imgSmoothing"),
        /** @type {HTMLSpanElement} Shows the FPS for {@linkcode html.view.htmlCanvas} (HTML: `FPS 00`) *///@ts-ignore element does exist in DOM
        fps:document.getElementById("gifFPS")
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
        area:document.getElementById("userInputArea"),
        /** @type {HTMLProgressElement} Progress bar to show timeout (milliseconds) for user input delay (remove `value` attribute when infinite timeout and `0` for no timeout - also update `max` accordingly (non-zero value)) *///@ts-ignore element does exist in DOM
        timeout:document.getElementById("userInputTimeout"),
        /** @type {HTMLSpanElement} Shows timeout for user input in milliseconds (see {@linkcode html.userInput.timeout} - `∞` when infinite timeout and empty for no timeout - in HTML: `█ ms`) *///@ts-ignore element does exist in DOM
        timeoutTime:document.getElementById("userInputTimeoutTime"),
        /** @type {HTMLInputElement} Button for user input, continues playback when waiting for user input *///@ts-ignore element does exist in DOM
        input:document.getElementById("userInput"),
        /** @type {HTMLInputElement} Button to `data-toggle` user input lock (1 ON / 0 OFF (default)) if ON, does not wait and continues playback instantly *///@ts-ignore element does exist in DOM
        lock:document.getElementById("userInputLock")
    }),
    loop:Object.freeze({
        /** @type {HTMLFieldSetElement} *///@ts-ignore element does exist in DOM
        area:document.getElementById("loopArea"),
        /** @type {HTMLSpanElement} Shows the current looping amount (HTML: `[CURRENT of MAX] Loops`) *///@ts-ignore element does exist in DOM
        loopText:document.getElementById("loopText"),
        /** @type {HTMLInputElement} Button to `data-toggle` force infinite looping *///@ts-ignore element does exist in DOM
        toggle:document.getElementById("loopForce"),
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
        /** @type {CanvasRenderingContext2D} The frame canvas (2D context of {@linkcode html.frame.htmlCanvas}) for the current frame *///@ts-ignore element does exist in DOM - checked for null further below
        canvas:document.getElementById("htmlFrameCanvas").getContext("2d",{colorSpace:"srgb"}),
        /** @type {HTMLDivElement} container for the {@linkcode html.frame.hmtlCanvas} controls *///@ts-ignore element does exist in DOM
        controls:document.getElementById("frameViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.frame.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow:document.getElementById("frameFullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 fit to {@linkcode html.frame.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow:document.getElementById("frameFitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 pixelated `🙾` (default) and 1 smooth `🙼` image rendering via class `smooth` *///@ts-ignore element does exist in DOM
        imgSmoothing:document.getElementById("frameImgSmoothing"),
        /** @type {HTMLSpanElement} Shows the FPS for {@linkcode html.frame.htmlCanvas} (HTML: `FPS 00`) *///@ts-ignore element does exist in DOM
        fps:document.getElementById("frameFPS"),
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
        /** If the {@linkcode html.userInput.lock} should be toggled on - default `0` (OFF) */
        userLock:(args.get("userLock")??"0")!=="0",
        /** If the {@linkcode html.view.fullWindow} should be toggled on - default `0` (OFF) */
        gifFull:(args.get("gifFull")??"0")!=="0",
        /** If the {@linkcode html.view.fitWindow} should be toggled on - default `0` (OFF) */
        gifReal:(args.get("gifReal")??"0")!=="0",
        /** If the {@linkcode html.view.imgSmoothing} should be toggled on - default `0` (OFF) */
        gifSmooth:(args.get("gifSmooth")??"0")!=="0",
        /** If the {@linkcode html.frame.fullWindow} should be toggled on - default `0` (OFF) */
        frameFull:(args.get("frameFull")??"0")!=="0",
        /** If the {@linkcode html.frame.fitWindow} should be toggled on - default `0` (OFF) */
        frameReal:(args.get("frameReal")??"0")!=="0",
        /** If the {@linkcode html.frame.imgSmoothing} should be toggled on - default `0` (OFF) */
        frameSmooth:(args.get("frameSmooth")??"0")!=="0",
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

//~  _____ _       _           _
//~ |  __ \ |     | |         | |
//~ | |  \/ | ___ | |__   __ _| |___
//~ | | __| |/ _ \| '_ \ / _` | / __|
//~ | |_\ \ | (_) | |_) | (_| | \__ \
//~  \____/_|\___/|_.__/ \__,_|_|___/

/** Global variables (sealed object) */
const global=Object.seal({
    /** @type {GIF} current loaded GIF *///@ts-ignore better to throw an error when it's unexpectedly still null than have ?. everywhere
    gifDecode:null,
    /** @type {number[]} array of start times of every frame in {@linkcode global.gifDecode.frames} (same indecies) */
    frameStarts:[],
    /** @type {{add(fps:number):void,sum:number}} last few frame times (fixed to size 8) */
    fps:new class{
        /** @param {number} size - size of the stored list */
        constructor(size){
            this._arr_=new Float64Array(size);
            this._pos_=0;
            this._len_=0;
        }
        /** @param {number} ft - new frame time (time in milliseconds from last to current frame) to add to the list */
        add(ft){
            this._arr_[this._pos_=(this._pos_+1)%this._arr_.length]=0x3E8/ft;
            if(this._len_<this._arr_.length)this._len_++;
        }
        /** @returns {number} average of all stored frame times converted to FPS */
        get sum(){
            let sum=0;
            for(let i=0;i<this._len_;i++)sum+=this._arr_[i];
            return sum/this._arr_.length;
        }
    }(8),
    /** last frame timestamp of animation loop (not related to GIF) */
    lastAnimationFrameTime:0,
    /** current timestamp of GIF */
    time:0,
    /** total time of GIF (ignoring user input flags) */
    totalTime:0,
    /** @type {0|1|-1} `0` paused | `1` playing | `-1` reverse (also see {@linkcode html.controls.container} class) */
    playback:0,
    /** if {@linkcode html.userInput.lock} is ON */
    userInputLock:false,
    /** if {@linkcode html.userInput.area} has class `waiting` */
    userInputWaiting:false,
    /** if {@linkcode html.userInput.area} has class `infinity` */
    userInputInfinity:false,
    /** (if not `NaN`) this is the frame index where {@linkcode html.userInput.input} was pressed (skip that frame and set this to `NaN` after use) */
    skipFrame:NaN,
    /** how often the GIF should repeat (0 = one playthrough) - {@linkcode getGIFLoopAmount} (0 to 65'535 or `Infinity`) */
    loops:0,
    /** how many time the GIF has repeated (0 = first playthrough → {@linkcode global.loopEnd}) - max {@linkcode global.loops} (0 to 65'535 or `Infinity`) */
    loopCounter:0,
    /** if `true` override {@linkcode global.loops} to be `Infinity` */
    loopForce:false,
    /** if `true` indicates the playback has reached the min/max loop amount and is paused */
    loopEnd:true,
    /** current frame index to render */
    frameIndex:0,
    /** frame index in last render loop (to reduce redundant rendering) */
    frameIndexLast:0,
    /** `true` when currently dragging {@linkcode html.view.view} or {@linkcode html.frame.view} */
    dragging:false,
    /** if `true` dragging is from {@linkcode html.view.view} and when `false` from {@linkcode html.frame.view} */
    draggingGIF:true,
    /** current mouse X position (only updated when {@linkcode global.dragging} is `true`) */
    mouseX:0,
    /** current mouse Y position (only updated when {@linkcode global.dragging} is `true`) */
    mouseY:0,
    /** current (subpixel) offset from the left for {@linkcode html.view.view} and {@linkcode html.frame.view} */
    panLeft:0,
    /** current (subpixel) offset frome the top for {@linkcode html.view.view} and {@linkcode html.frame.view} */
    panTop:0,
    /** zooming for {@linkcode html.view.view} and {@linkcode html.frame.view} */
    scaler:0
});

//~  _   _ _   _ _ _ _            __                  _   _
//~ | | | | | (_) (_) |          / _|                | | (_)
//~ | | | | |_ _| |_| |_ _   _  | |_ _   _ _ __   ___| |_ _  ___  _ __  ___
//~ | | | | __| | | | __| | | | |  _| | | | '_ \ / __| __| |/ _ \| '_ \/ __|
//~ | |_| | |_| | | | |_| |_| | | | | |_| | | | | (__| |_| | (_) | | | \__ \
//~  \___/ \__|_|_|_|\__|\__, | |_|  \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
//~                       __/ |
//~                      |___/

/**
 * ## Imports a GIF automatically and renders the first frame (paused - without showing {@linkcode html.import.menu} except for errors)
 * _async function_
 * @param {string} url - a URL that leads to a GIF file
 * @returns {Promise<boolean>} `true` if the GIF was successfully loaded and the first frame was drawn and `false` otherwise (shows {@linkcode html.import.menu} for error feedback)
 */
const silentImportGIF=async url=>{
    "use strict";
    blockInput(true);
    if(await new Promise(E=>{
        "use strict";
        /** @param {boolean} success */
        const R=success=>{
            "use strict";
            html.root.removeEventListener("loadpreview",()=>R(true));
            html.root.removeEventListener("loadcancel",()=>R(false));
            E(success);
        };
        html.root.addEventListener("loadpreview",()=>R(true),{passive:true,once:true});
        html.root.addEventListener("loadcancel",()=>R(false),{passive:true,once:true});
        html.import.url.value=url;
        html.import.url.dispatchEvent(new InputEvent("change"));
    }))return await new Promise(E=>{
        "use strict";
        /** @param {boolean} success */
        const R=success=>{
            "use strict";
            html.root.removeEventListener("loadend",()=>R(true));
            html.root.removeEventListener("loaderror",()=>R(false));
            E(success);
        };
        html.root.addEventListener("loadend",()=>R(true),{passive:true,once:true});
        html.root.addEventListener("loaderror",()=>R(false),{passive:true,once:true});
        html.import.confirm.click();
    });
    html.import.menu.showModal();
    blockInput(false);
    html.import.abort.focus();
    return false;
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
    const width=Number.parseFloat(canvasStyle.width),
        height=Number.parseFloat(canvasStyle.height);
    html.root.style.setProperty("--offset-view-left",`${Math.trunc(global.panLeft=Math.max(width*-.5,Math.min(width*.5,left??global.panLeft)))}px`);
    html.root.style.setProperty("--offset-view-top",`${Math.trunc(global.panTop=Math.max(height*-.5,Math.min(height*.5,top??global.panTop)))}px`);
};

/**
 * ## Blocks input by disableing all interactible elements on the page
 * removes focus from currently focused element (if any) when {@linkcode state} is `true`
 * @param {boolean} state - disables inputs on `true` and re-enables input on `false`
 */
const blockInput=state=>{
    if(state&&(document.activeElement instanceof HTMLElement||document.activeElement instanceof MathMLElement||document.activeElement instanceof SVGElement))document.activeElement?.blur();
    html.view.fullWindow.disabled=state;
    html.view.fitWindow.disabled=state;
    html.view.imgSmoothing.disabled=state;
    html.frameTime.frameRange.ariaDisabled=state?"true":null;
    html.frameTime.frameRange.tabIndex=state?-1:0;
    html.controls.seekEnd.disabled=state;
    html.controls.seekPrevious.disabled=state;
    html.controls.reverse.disabled=state;
    html.controls.pause.disabled=state;
    html.controls.play.disabled=state;
    html.controls.seekNext.disabled=state;
    html.controls.seekStart.disabled=state;
    html.userInput.input.disabled=state||global.userInputLock;
    html.userInput.lock.disabled=state;
    html.loop.toggle.disabled=state||global.loops===Infinity;
    html.open.disabled=state;
    html.frame.fullWindow.disabled=state;
    html.frame.fitWindow.disabled=state;
    html.frame.imgSmoothing.disabled=state;
}

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
 * ## Update all values in {@linkcode html.frame} and {@linkcode html.loop}
 * call at beginning of each frame\
 * _uses {@linkcode global.gifDecode}, {@linkcode global.frameIndex}, {@linkcode global.loops}, and {@linkcode global.loopCounter}_
 */
const updateFrameInfo=()=>{
    "use strict";
    html.loop.loopText.textContent=global.loops===Infinity?"Infinite":(global.loops===0?"no":`${global.loopCounter} of ${global.loops}`);
    const f=global.gifDecode.frames[global.frameIndex];
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
        html.frame.text.foreground.value=global.gifDecode.globalColorTable[f.plainTextData.foregroundColor].reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"#");
        //@ts-ignore `f.plainTextData` can not be `null` here
        html.frame.text.background.value=global.gifDecode.globalColorTable[f.plainTextData.backgroundColor].reduce((o,v)=>o+v.toString(0x10).toUpperCase().padStart(2,'0'),"#");
    }
};
/**
 * ## Update all values of {@linkcode html.frameTime} (except {@linkcode html.frameTime.timeTickmarks}) and {@linkcode html.userInput} (if {@linkcode Frame.userInputDelayFlag} is given and {@linkcode html.userInput.lock} is OFF)
 * call each frame (before {@linkcode updateTimeInfo})\
 * _uses {@linkcode global.gifDecode}, {@linkcode global.frameIndex}, and {@linkcode global.time}_
 */
const updateTimeInfoFrame=()=>{
    "use strict";
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=global.time.toFixed(0));
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex));
    if(html.userInput.area.classList.toggle("waiting",global.userInputWaiting=!global.userInputLock&&global.gifDecode.frames[global.frameIndex].userInputDelayFlag)){
        if(html.userInput.area.classList.toggle("infinity",global.userInputInfinity=global.gifDecode.frames[global.frameIndex].delayTime===0)){
            html.userInput.timeoutTime.textContent="∞";
            html.userInput.timeout.removeAttribute("value");
        }else html.userInput.timeoutTime.textContent=`-${(html.userInput.timeout.max=global.gifDecode.frames[global.frameIndex].delayTime)-(html.userInput.timeout.value=global.time-global.frameStarts[global.frameIndex])}`;
    }else{
        html.userInput.area.classList.toggle("infinity",global.userInputInfinity=false);
        html.userInput.timeoutTime.textContent="-";
        html.userInput.timeout.value=0;
    }
};
/**
 * ## Update all values of {@linkcode html.frameTime} (except {@linkcode html.frameTime.timeTickmarks}) and {@linkcode html.userInput}
 * call for every time step\
 * _uses {@linkcode global.gifDecode}, {@linkcode global.frameIndex}, and {@linkcode global.time}_
 */
const updateTimeInfo=()=>{
    "use strict";
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=global.time.toFixed(0));
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex));
    if(global.userInputWaiting&&!global.userInputInfinity)html.userInput.timeoutTime.textContent=`-${(html.userInput.timeout.max=global.gifDecode.frames[global.frameIndex].delayTime)-(html.userInput.timeout.value=global.time-global.frameStarts[global.frameIndex])}`;
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

html.import.preview.loading="eager";

html.root.style.setProperty("--offset-view-left","0px");
html.root.style.setProperty("--offset-view-top","0px");
html.root.style.setProperty("--canvas-width","0px");
html.root.style.setProperty("--canvas-scaler","1.0");

blockInput(true);

html.frame.text.foreground.addEventListener("click",copyHexColorToClipboard,{passive:false});
html.frame.text.background.addEventListener("click",copyHexColorToClipboard,{passive:false});

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
    if((html.view.imgSmoothing.dataset.toggle??"0")==="0"){
        html.view.imgSmoothing.dataset.toggle="1";
        html.view.imgSmoothing.value="🙼";
        html.view.htmlCanvas.classList.add("smooth");
    }else{
        html.view.imgSmoothing.dataset.toggle="0";
        html.view.imgSmoothing.value="🙾";
        html.view.htmlCanvas.classList.remove("smooth");
    }
},{passive:true});
html.frame.imgSmoothing.addEventListener("click",()=>{
    "use strict";
    if((html.frame.imgSmoothing.dataset.toggle??"0")==="0"){
        html.frame.imgSmoothing.dataset.toggle="1";
        html.frame.imgSmoothing.value="🙼";
        html.frame.htmlCanvas.classList.add("smooth");
    }else{
        html.frame.imgSmoothing.dataset.toggle="0";
        html.frame.imgSmoothing.value="🙾";
        html.frame.htmlCanvas.classList.remove("smooth");
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
        global.panLeft+(ev.clientX-global.mouseX),
        global.panTop+(ev.clientY-global.mouseY)
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
    const canvasStyle=(ev.target===html.view.view||ev.target===html.view.htmlCanvas)?html.view.canvasStyle:html.frame.canvasStyle,
        previousWidth=Number.parseFloat(canvasStyle.width),
        previousHeight=Number.parseFloat(canvasStyle.height);
    html.root.style.setProperty("--canvas-scaler",String(
        Math.exp((
            global.scaler=Math.max(
                global.gifDecode.width*-.5,
                Math.min(
                    global.gifDecode.width*.5,
                    global.scaler+(ev.deltaY*-(ev.shiftKey?.5:ev.altKey?.01:.1))
                )
            )
        )*.01)
    ));
    setCanvasOffset(
        canvasStyle,
        (Number.parseFloat(canvasStyle.width)*global.panLeft)/previousWidth,
        (Number.parseFloat(canvasStyle.height)*global.panTop)/previousHeight
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
    if((html.import.url.value=html.import.url.value.trim())===""){
        html.import.warn.textContent=(html.import.preview.src="");
        html.import.confirm.disabled=!(html.import.file.disabled=false);
        html.root.dispatchEvent(new CustomEvent("loadcancel"));
        return;
    }
    const check=await(async url=>{
        "use strict";
        if(url.startsWith("javascript:"))return null;
        if(url.startsWith("data:"))return url.startsWith("data:image/")?/^data:image\/gif[;,]/.test(url):null;
        return await new Promise(/**@param {(value:boolean|null)=>void} E*/E=>{
            "use strict";
            /** @param {boolean} success */
            const R=success=>{
                "use strict";
                html.import.preview.removeEventListener("load",()=>R(true));
                html.import.preview.removeEventListener("error",()=>R(false));
                E(success?true:null);
            };
            html.import.preview.addEventListener("load",()=>R(true),{passive:true,once:true});
            html.import.preview.addEventListener("error",()=>R(false),{passive:true,once:true});
            html.import.preview.src=url;
        });
        //! can't check MIME-type with HEAD-fetch due to CORS (some servers also don't allow HEAD-fetch for images)
        //! ~let `decodeGIF` figure out if this is a GIF file (or the GET request still results in a "fetch error")
    })(html.import.url.value);
    if(!(check??false))html.import.preview.src="";
    html.import.warn.textContent=check==null?"Given URL does not lead to an image":(check?"":"Given URL does not lead to a GIF image");
    html.root.dispatchEvent(new CustomEvent((html.import.confirm.disabled=!(html.import.file.disabled=check??false))?"loadcancel":"loadpreview"));
},{passive:true});
html.import.file.addEventListener("change",async()=>{
    "use strict";
    html.import.url.disabled=false;
    html.import.preview.src="";
    html.import.confirm.disabled=true;
    if(html.import.file.files==null||html.import.file.files.length===0){
        html.import.warn.textContent="";
        html.root.dispatchEvent(new CustomEvent("loadcancel"));
        return;
    }
    if(html.import.file.files.length>1){
        html.import.warn.textContent="Please only select one file";
        html.root.dispatchEvent(new CustomEvent("loadcancel"));
        return;
    }
    const version=await html.import.file.files[0].slice(0,6).text().then(null,reason=>{return{reason};}).catch(reason=>{return{reason};});
    if(typeof version==="object"){
        html.import.warn.textContent=`Error reading file: ${version.reason}`;
        html.root.dispatchEvent(new CustomEvent("loadcancel"));
        return;
    }
    if(version!=="GIF89a"){
        html.import.warn.textContent="Provided file is not a suported GIF file (GIF89a)";
        html.root.dispatchEvent(new CustomEvent("loadcancel"));
        return;
    }
    html.import.url.disabled=true;
    html.import.warn.textContent="";
    html.import.preview.src=URL.createObjectURL(html.import.file.files[0]);
    html.import.confirm.disabled=false;
    html.root.dispatchEvent(new CustomEvent("loadpreview"));
},{passive:true});

//~ load & decode GIF (log fetch progress & show visual decoding progress), update/reset variables/UI, and render first frame (paused) or open inport menu for error feedback

html.import.confirm.addEventListener("click",async()=>{
    "use strict";
    const fileSrc=html.import.preview.src,
        fileName=html.import.url.disabled?html.import.file.files?.[0]?.name:html.import.url.value.match(/^[^#?]+?\/?(.+?\.gif)(?:[#?]|$)/i)?.[0];
    blockInput(true);
    html.import.menu.close();
    if(global.playback!==0)html.controls.pause.click();
    html.loading.gif.classList.remove("done");
    html.loading.frame.classList.remove("done");
    html.loading.gifProgress.removeAttribute("value");
    html.loading.frameProgress.removeAttribute("value");
    html.loading.gifText.textContent="Loading...";
    html.loading.frameText.textContent="Loading...";
    await new Promise(E=>setTimeout(E,0));
    html.root.dispatchEvent(new CustomEvent("loadstart"));
    decodeGIF(fileSrc,undefined,async(percentageRead,frameIndex,frame,framePos,gifSize)=>{
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
    },(loaded,total)=>{
        "use strict";
        if(total==null)console.log(`%cFetching GIF: %i bytes loaded`,"background-color:#000;color:#0A0;",loaded);
        else console.log(`%cFetching GIF: %i of %i bytes loaded (%s %%)`,"background-color:#000;color:#0A0;",loaded,total,(loaded*0x64/total).toFixed(2).padStart(6,' '));
    }).then(gif=>{
        "use strict";
        //~ reset variables and UI
        html.loop.toggle.disabled=(global.loops=getGIFLoopAmount(global.gifDecode=gif))===Infinity;
        global.loopCounter=(global.time=(global.frameIndex=(global.frameIndexLast=0)));
        global.loopEnd=true;
        global.skipFrame=NaN;
        html.loading.gif.classList.add("done");
        html.loading.frame.classList.add("done");
        //~ update GIF info
        html.info.fileName.textContent=fileName??"";
        html.info.totalWidth.textContent=String(global.gifDecode.width);
        html.info.totalHeight.textContent=String(global.gifDecode.height);
        html.info.totalFrames.textContent=String(global.gifDecode.frames.length);
        html.info.totalTime.textContent=global.gifDecode.totalTime===Infinity?"Infinity (waits for user input)":`${global.gifDecode.totalTime} ms`;
        if(global.gifDecode.pixelAspectRatio===0||global.gifDecode.pixelAspectRatio===1)html.info.pixelAspectRatio.textContent="1:1 (square pixels)";
        else{
            const fracGCD=0x40/gcd(global.gifDecode.pixelAspectRatio*0x40,0x40);
            html.info.pixelAspectRatio.textContent=`${global.gifDecode.pixelAspectRatio*fracGCD}:${fracGCD} (${global.gifDecode.pixelAspectRatio}:1)`;
        }
        html.info.colorRes.textContent=`${global.gifDecode.colorRes} bits`;
        html.info.globalColorTable.replaceChildren(...genHTMLColorGrid(global.gifDecode.globalColorTable,true,global.gifDecode.backgroundColorIndex));
        html.info.appExtList.replaceChildren(...genHTMLAppExtList(global.gifDecode.applicationExtensions));
        html.info.commentsList.replaceChildren(...genHTMLCommentList(global.gifDecode.comments));
        html.info.unExtList.replaceChildren(...getHTMLUnExtList(global.gifDecode.unknownExtensions));
        //~ update time info (init)
        let timeSum=0;
        html.frameTime.timeTickmarks.replaceChildren(...global.gifDecode.frames.map((v,j)=>{
            const option=document.createElement("option");
            option.title=`Frame [${j}]`;
            option.text=String(timeSum);
            global.frameStarts[j]=timeSum;
            timeSum+=v.delayTime;
            return option;
        }));
        html.frameTime.timeRange.max=String(global.totalTime=timeSum);
        html.frameTime.frameRange.max=String(global.gifDecode.frames.length-1);
        updateFrameInfo();
        updateTimeInfoFrame();
        //~ render first frame to every canvas
        html.view.canvas.clearRect(0,0,html.view.htmlCanvas.width,html.view.htmlCanvas.height);
        html.view.canvas.putImageData(gif.frames[0].image,gif.frames[0].left,gif.frames[0].top);
        html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
        html.frame.canvas.putImageData(gif.frames[0].image,gif.frames[0].left,gif.frames[0].top);
        //~ reset pan & zoom
        setCanvasOffset(html.view.canvasStyle,0,0);
        setCanvasOffset(html.frame.canvasStyle,0,0);
        global.scaler=0;
        html.root.style.setProperty("--canvas-scaler","1");
        //~ end loading
        blockInput(false);
        html.controls.pause.focus();
        html.root.dispatchEvent(new CustomEvent("loadend"));
    },reason=>{
        "use strict";
        html.import.warn.textContent=reason;
        html.import.menu.showModal();
        html.loading.gif.classList.add("done");
        html.loading.frame.classList.add("done");
        blockInput(false);
        html.import.abort.focus();
        html.root.dispatchEvent(new CustomEvent("loaderror"));
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
    if(global.playback!==0)html.controls.pause.click();
    if(!global.loopForce&&Number.isFinite(global.loops))global.loopCounter=0;
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex=0));
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(global.time=global.frameStarts[global.frameIndex]));
},{passive:true});
html.controls.seekEnd.addEventListener("click",()=>{
    "use strict";
    if(global.playback!==0)html.controls.pause.click();
    if(!global.loopForce&&Number.isFinite(global.loops))global.loopCounter=global.loops;
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex=global.gifDecode.frames.length-1));
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(global.time=global.frameStarts[global.frameIndex]));
},{passive:true});

html.controls.seekNext.addEventListener("click",()=>{
    "use strict";
    if(global.playback!==0)html.controls.pause.click();
    if(++global.frameIndex>=global.gifDecode.frames.length){
        global.frameIndex=0;
        if(!global.loopForce&&Number.isFinite(global.loops)&&++global.loopCounter>global.loops)global.loopCounter=0;
    }
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex));
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(global.time=global.frameStarts[global.frameIndex]));
},{passive:true});
html.controls.seekPrevious.addEventListener("click",()=>{
    "use strict";
    if(global.playback!==0)html.controls.pause.click();
    if(--global.frameIndex<0){
        global.frameIndex=global.gifDecode.frames.length-1;
        if(!global.loopForce&&Number.isFinite(global.loops)&&--global.loopCounter<0)global.loopCounter=global.loops;
    }
    html.frameTime.frameRange.value=(html.frameTime.frame.textContent=String(global.frameIndex));
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(global.time=global.frameStarts[global.frameIndex]));
},{passive:true});

html.controls.pause.addEventListener("click",()=>{
    "use strict";
    html.controls.container.classList.value="paused";
    global.playback=0;
},{passive:true});
html.controls.play.addEventListener("click",()=>{
    "use strict";
    html.controls.container.classList.value="playing";
    global.playback=1;
},{passive:true});
html.controls.reverse.addEventListener("click",()=>{
    "use strict";
    html.controls.container.classList.value="reverse";
    global.playback=-1;
},{passive:true});

html.frameTime.frameRange.addEventListener("input",()=>{
    "use strict";
    if(global.playback!==0)html.controls.pause.click();
    html.frameTime.timeRange.value=(html.frameTime.time.textContent=String(global.time=global.frameStarts[global.frameIndex=Number(html.frameTime.frame.textContent=html.frameTime.frameRange.value)]));
},{passive:true});

html.userInput.lock.addEventListener("click",()=>{
    "use strict";
    if((html.userInput.lock.dataset.toggle??"0")==="0"){
        html.userInput.lock.dataset.toggle="1";
        html.userInput.input.disabled=(global.userInputLock=true);
        global.skipFrame=NaN;
    }else{
        html.userInput.lock.dataset.toggle="0";
        html.userInput.input.disabled=(global.userInputLock=false);
    }
},{passive:true});
html.userInput.input.addEventListener("click",()=>{
    "user strict";
    global.skipFrame=global.frameIndex;
},{passive:true});

html.loop.toggle.addEventListener("click",()=>{
    "use strict";
    html.loop.toggle.dataset.toggle=(global.loopForce=!global.loopForce)?"1":"0";
},{passive:true});

//~  _____ ___________                      _
//~ |  __ \_   _|  ___|                    | |
//~ | |  \/ | | | |_     _ __ ___ _ __   __| | ___ _ __
//~ | | __  | | |  _|   | '__/ _ \ '_ \ / _` |/ _ \ '__|
//~ | |_\ \_| |_| |     | | |  __/ | | | (_| |  __/ |
//~  \____/\___/\_|     |_|  \___|_| |_|\__,_|\___|_|

// TODO ! test edge-cases
//~ load URL parameters
(async()=>{
    "use strict";
    //~ wait for one cycle
    await new Promise(E=>setTimeout(E,0));
    html.details.gifInfo.toggleAttribute("open",urlParam.gifInfo);
    html.details.globalColorTable.toggleAttribute("open",urlParam.globalColorTable);
    html.details.appExtList.toggleAttribute("open",urlParam.appExtList);
    html.details.commentsList.toggleAttribute("open",urlParam.commentsList);
    html.details.unExtList.toggleAttribute("open",urlParam.unExtList);
    html.details.frameView.toggleAttribute("open",(!urlParam.import&&!urlParam.gifFull&&urlParam.frameFull)||urlParam.frameView);
    html.details.frameInfo.toggleAttribute("open",urlParam.frameInfo);
    html.details.localColorTable.toggleAttribute("open",urlParam.localColorTable);
    html.details.frameText.toggleAttribute("open",urlParam.frameText);
    if(urlParam.import){
        html.import.menu.showModal();
        blockInput(false);
        if(urlParam.url!=null){
            html.import.url.value=urlParam.url;
            html.import.url.dispatchEvent(new Event("change"));
        }
        return;
    }
    //~ load GIF
    /* TODO create example GIF file with all known features - https://www.w3.org/Graphics/GIF/spec-gif89a.txt - via GIMP and then edit in HEX-editor ~ create empty file with new size then override all bytes (since vscode-hexeditor can't add bytes...yet)
        - 500*500 px total
        - 30 frames
          - irregular frame delays
          - not full frame changes (frames are smaller than whole GIF)
        - every disposal method
          - ! requires some planning in the frame image contents ~ visually
        - loops 3 times
        - global color table and at least one local color table (can be a copy of global color table)
          - use transparency of local color table
        - user input flag on at least two frames (with and without timeout)
        - unknown app extension
          - 0x21FF0C544553545F4150502045585400
        - text extensions for first 10 frames (graphics control extension > image descriptor > [text extension] > image data)
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B305D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B315D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B325D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B335D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B345D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B355D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B365D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B375D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B385D00
          - 0x21010C0A000A00200010000408 <forground_global_color_index_1B> <background_global_color_index_1B> 105445585420666F726672616D655B395D00
        - comment after image descriptor and before image data for the last frame
          - 0x21FE4D5445535420636F6D6D656E740D0A616674657220696D6167652064657363726970746F7220616E64206265666F726520696D616765206461746120666F7220746865206C617374206672616D6500
        - comment after image descriptor and before image data for the 10th frame
          - 0x21FE4D5445535420636F6D6D656E740D0A616674657220696D6167652064657363726970746F7220616E64206265666F726520696D616765206461746120666F72207468652031307468206672616D6500
        - comment after image descriptor and before image data for the 100th frame
          - 0x21FE4E5445535420636F6D6D656E740D0A616674657220696D6167652064657363726970746F7220616E64206265666F726520696D616765206461746120666F7220746865203130307468206672616D6500
        - unknown extensions (after image data (and app extension) of frames 0-3)
          - unknown extension 0
            - 0x2154115445535420657874656E73696F6E20233000
          - unknown extension 1
            - 0x2145115445535420657874656E73696F6E20233100
          - unknown extension 2
            - 0x2153115445535420657874656E73696F6E20233200
          - unknown extension 3
            - 0x2154115445535420657874656E73696F6E20233300
    */
    if(!await silentImportGIF(urlParam.url??"Wax_fire.gif"))return;
    if(urlParam.f!==0){
        html.frameTime.frameRange.value=String(urlParam.f);
        html.frameTime.frameRange.dispatchEvent(new InputEvent("input"));
    }
    if(urlParam.gifFull)html.view.fullWindow.click();
    else if(urlParam.frameFull)html.frame.fullWindow.click();
    if(urlParam.gifReal)html.view.fitWindow.click();
    if(urlParam.gifSmooth)html.view.imgSmoothing.click();
    if(urlParam.userLock)html.userInput.lock.click();
    if(urlParam.frameView){
        if(urlParam.frameReal)html.frame.fitWindow.click();
        if(urlParam.frameSmooth)html.frame.imgSmoothing.click();
    }
    if(urlParam.gifReal||(urlParam.frameReal&&(urlParam.frameView||(!urlParam.gifFull&&urlParam.frameFull)))){
        const canvasStyle=urlParam.gifReal?html.view.canvasStyle:html.frame.canvasStyle;
        if(urlParam.pos[0]!==0||urlParam.pos[1]!==0)setCanvasOffset(canvasStyle,...urlParam.pos);
        //~ wait for one cycle
        //? await new Promise(E=>setTimeout(E,0));
        if(urlParam.zoom!==0){
            const previousWidth=Number.parseFloat(canvasStyle.width),
                previousHeight=Number.parseFloat(canvasStyle.height);
            html.root.style.setProperty("--canvas-scaler",String(
                Math.exp((
                    global.scaler=Math.max(
                        global.gifDecode.width*-.5,
                        Math.min(
                            global.gifDecode.width*.5,
                            urlParam.zoom
                        )
                    )
                )*.01)
            ));
            //~ wait for one cycle
            //? await new Promise(E=>setTimeout(E,0));
            setCanvasOffset(
                canvasStyle,
                (Number.parseFloat(canvasStyle.width)*global.panLeft)/previousWidth,
                (Number.parseFloat(canvasStyle.height)*global.panTop)/previousHeight
            );
        }
    }
    if(urlParam.play)html.controls.play.click();
})();

//~ animation loop
window.requestAnimationFrame(async function loop(time){
    "use strict";
    if(time===global.lastAnimationFrameTime){window.requestAnimationFrame(loop);return;}
    const delta=time-global.lastAnimationFrameTime,
        previousPlayback=global.playback;
    global.fps.add(delta);
    html.view.fps.textContent=(html.frame.fps.textContent=`FPS ${global.fps.sum.toFixed(0).padStart(3,' ')}`);
    //~ calculate time, frame, and loop amount (with user input)
    let seek=global.playback*delta;
    if(seek<0) do{//~ reverse seek
        let i=global.frameIndex,
            f=global.gifDecode.frames[i];
        if(f.userInputDelayFlag&&(f.delayTime===0&&!(i===global.skipFrame||global.userInputLock)))break;
        if(!f.userInputDelayFlag||!(i===global.skipFrame||global.userInputLock)){
            if(global.time+seek>=global.frameStarts[i]){
                global.time+=seek;
                break;
            }
            seek+=global.time-global.frameStarts[i];
        }
        do{
            if(--i<0){
                if(!global.loopForce&&Number.isFinite(global.loops)&&--global.loopCounter<0){
                    if(global.loopEnd=!global.loopEnd){
                        global.time=(global.frameIndex=0);
                        global.loopCounter=0;
                        html.controls.pause.click();
                        break;
                    }else global.loopEnd=false;
                    global.loopCounter=global.loops;
                }else global.loopEnd=false;
                i+=global.gifDecode.frames.length;
            }
            f=global.gifDecode.frames[i];
            if(f.userInputDelayFlag&&(f.delayTime===0&&!global.userInputLock)){
                global.time=global.frameStarts[i];
                global.frameIndex=i;
                break;
            }
            if(!f.userInputDelayFlag||!global.userInputLock){
                if(f.delayTime+seek>=0){
                    global.time=global.frameStarts[i]+f.delayTime+seek;
                    global.frameIndex=i;
                    break;
                }
                seek+=f.delayTime;
            }
        }while(true);
    }while(false);else if(seek>0) do{//~ forward seek
        let i=global.frameIndex,
            f=global.gifDecode.frames[i];
        if(f.userInputDelayFlag&&(f.delayTime===0&&!(i===global.skipFrame||global.userInputLock)))break;
        if(!f.userInputDelayFlag||!(i===global.skipFrame||global.userInputLock)){
            if(seek<f.delayTime-(global.time-global.frameStarts[i])){
                global.time+=seek;
                break;
            }
            seek-=f.delayTime-(global.time-global.frameStarts[i]);
        }
        do{
            if(++i>=global.gifDecode.frames.length){
                if(!global.loopForce&&Number.isFinite(global.loops)&&++global.loopCounter>global.loops){
                    if(global.loopEnd=!global.loopEnd){
                        global.time=global.totalTime;
                        global.frameIndex=global.gifDecode.frames.length-1;
                        global.loopCounter=global.loops;
                        html.controls.pause.click();
                        break;
                    }
                    global.loopCounter=0;
                }else global.loopEnd=false;
                i-=global.gifDecode.frames.length;
            }else global.loopEnd=false;
            f=global.gifDecode.frames[i];
            if(f.userInputDelayFlag&&(f.delayTime===0&&!global.userInputLock)){
                global.time=global.frameStarts[i];
                global.frameIndex=i;
                break;
            }
            if(!f.userInputDelayFlag||!global.userInputLock){
                if(seek<f.delayTime){
                    global.time=global.frameStarts[i]+seek;
                    global.frameIndex=i;
                    break;
                }
                seek-=f.delayTime;
            }
        }while(true);
    }while(false);else global.loopEnd=!global.loopForce&&Number.isFinite(global.loops)&&((global.frameIndex===0&&global.loopCounter===0)||(global.frameIndex===global.gifDecode.frames.length-1&&global.loopCounter===global.loops));
    global.skipFrame=NaN;
    await Promise.resolve();
    //~ render frame and update time
    if(global.frameIndex!==global.frameIndexLast){
        updateFrameInfo();
        updateTimeInfoFrame();
        // TODO pixel aspect ratio

        // TODO testing ! performance
        // TODO ? only go back as far as frame 0 when first loop (when not infinite looping)
        if(previousPlayback>0){
            const queue=[global.frameIndex];
            forLoop:for(
                let i=(global.frameIndex===0?global.gifDecode.frames.length:global.frameIndex)-1;
                global.frameIndex<(global.frameIndexLast+1)?i>global.frameIndex&&i<global.frameIndexLast:i<global.frameIndexLast;
                --i<0&&(i+=global.gifDecode.frames.length)
            )switch(global.gifDecode.frames[i].disposalMethod){
                case DisposalMethod.UndefinedA://! fall through
                case DisposalMethod.UndefinedB://! fall through
                case DisposalMethod.UndefinedC://! fall through
                case DisposalMethod.UndefinedD://! fall through
                case DisposalMethod.Unspecified://! fall through
                case DisposalMethod.DoNotDispose:
                    queue.push[i];
                break;
                case DisposalMethod.RestoreBackgroundColor:
                const f=global.gifDecode.frames[i];
                    html.view.canvas.fillStyle=global.gifDecode.backgroundColorIndex==null?"#000":`rgb(${global.gifDecode.globalColorTable[global.gifDecode.backgroundColorIndex].join(' ')} / ${global.gifDecode.backgroundColorIndex===f.transparentColorIndex?'0':'1'})`;
                    html.view.canvas.fillRect(f.left,f.top,f.width,f.height);
                break forLoop;
                case DisposalMethod.RestorePrevious:break;
            }
            for(let i=queue.length-1,f=global.gifDecode.frames[queue[i]];i>=0;--i>=0&&(f=global.gifDecode.frames[queue[i]])){
                html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
                html.frame.canvas.putImageData(f.image,f.left,f.top);
                html.view.canvas.drawImage(html.frame.htmlCanvas,f.left,f.top,f.width,f.height,f.left,f.top,f.width,f.height);
            }
        }else
        // TODO invert for reverse ~ paused depends ? from 0 or continue...

        if(global.frameIndex>global.frameIndexLast)for(let i=global.frameIndexLast+1;i<=global.frameIndex;i++){
            html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
            html.frame.canvas.putImageData(global.gifDecode.frames[i].image,global.gifDecode.frames[i].left,global.gifDecode.frames[i].top);
            // TODO disposal method (via offscreen canvas)
            html.view.canvas.drawImage(html.frame.htmlCanvas,0,0);
            if(i%100===0)await Promise.resolve();
        }else{
            //~ render from beginning (expect frame drops)
            html.view.canvas.clearRect(0,0,html.view.htmlCanvas.width,html.view.htmlCanvas.height);
            for(let i=0;i<=global.frameIndex;i++){
                html.frame.canvas.clearRect(0,0,html.frame.htmlCanvas.width,html.frame.htmlCanvas.height);
                html.frame.canvas.putImageData(global.gifDecode.frames[i].image,global.gifDecode.frames[i].left,global.gifDecode.frames[i].top);
                // TODO disposal method (via offscreen canvas)
                html.view.canvas.drawImage(html.frame.htmlCanvas,0,0);
                if(i%100===0)await Promise.resolve();
            }
        }
        // TODO text extension
        //? auto wraps to new line when grid width is reached (no fractional cells) and height does allow for it - otherwise end rendering even when there are characters left ~ pre calculate line breaks and string length
        //? cell height is font size (px)
        //? use CanvasRenderingContext2D.letterSpacing (can be negative) for cell width (px)
        //? monospace font family
        //? when reading characters <0x20 or >0xf7 render a space (0x20) instead
        //? draw text background as one big box with background color (index into global color table) ~ or as outline ? font a little larger and letter spacing a little smaller and draw behind the text
        //! check transparent color index of this frame as it also applies to the text extension for this frame
        global.frameIndexLast=global.frameIndex;
    }
    updateTimeInfo();
    global.lastAnimationFrameTime=time;
    window.requestAnimationFrame(loop);
});
