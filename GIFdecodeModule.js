//@ts-check
"use strict";//~ counts for the whole file
/**@class@template {unknown} T*/
export const Interrupt=class Interrupt{
    /**
     * @typedef {Object} InterruptSignal
     * @property {(timeout?:number)=>Promise<boolean>} check - see docs within {@linkcode Interrupt}
     * @property {AbortSignal} signal - see docs within {@linkcode Interrupt}
     */
    static #InterruptSignal=class InterruptSignal{
        #ref;
        /**
         * ## Create an {@linkcode AbortSignal} that will abort when {@linkcode Interrupt.abort} is called
         * when aborted, {@linkcode AbortSignal.reason} will be a reference to `this` {@linkcode InterruptSignal} object\
         * ! NOT influenced by {@linkcode Interrupt.pause}
         */
        get signal(){return this.#ref.#controller.signal;}
        /**
         * ## Create a new interrupt signal
         * can not modify signal, only read
         * @param {Interrupt} ref - reference to corresponding {@linkcode Interrupt} object
         * @throws {TypeError} when {@linkcode ref} is not an {@linkcode Interrupt} reference
         */
        constructor(ref){
            if(!(ref instanceof Interrupt))throw new TypeError("[InterruptSignal] ref is not an Interrupt reference.");
            this.#ref=ref;
        }
        /**
         * ## Check if signal was aborted
         * return delayed until signal is unpaused
         * @param {number} [timeout] - time in milliseconds for delay between pause-checks - default `0`
         * @returns {Promise<boolean>} when signal is aborted `true` otherwise `false`
         * @throws {TypeError} when {@linkcode timeout} is given but not a positive finite number
         */
        async check(timeout){
            if(timeout!=null&&(typeof timeout!=="number"||!Number.isFinite(timeout)||timeout<0))throw TypeError("[InterruptSignal] timeout is not a positive finite number.");
            const delay=timeout??0;
            for(;this.#ref.#paused;)await new Promise(E=>setTimeout(E,delay));
            return this.#ref.#aborted;
        }
        static{//~ make class and prototype immutable
            Object.freeze(InterruptSignal.prototype);
            Object.freeze(InterruptSignal);
        }
    };
    /**
     * ## Check if {@linkcode obj} is an interrupt signal (instance)
     * @param {unknown} obj
     * @returns {boolean} gives `true` when it is an interrupt signal and `false` otherwise
     */
    static isSignal(obj){return obj instanceof Interrupt.#InterruptSignal;}
    #paused=false;
    #aborted=false;
    #controller=new AbortController();
    #signal=new Interrupt.#InterruptSignal(this);
    /**@type {T|undefined}*/
    #reason=undefined;
    /**## get a signal for (only) checking for an abort*/
    get signal(){return this.#signal;}
    /**## get the reason for abort (`undefined` before abort)*/
    get reason(){return this.#reason;}
    /**## Pause signal (when not aborted)*/
    pause(){this.#paused=!this.#aborted;}
    /**## Unpause signal*/
    resume(){this.#paused=false;}
    /**
     * ## Abort signal
     * also unpauses signal
     * @param {T} [reason] - reason for abort
     */
    abort(reason){
        this.#reason=reason;
        this.#aborted=true;
        this.#paused=false;
        this.#controller.abort(this.#signal);
    }
    static{//~ make class and prototype immutable
        Object.freeze(Interrupt.prototype);
        Object.freeze(Interrupt);
    }
};
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
export const DisposalMethod=Object.freeze({
    /**unspecified > do nothing (default to {@linkcode DisposalMethod.DoNotDispose})*/Unspecified:0,
    /**do not dispose > keep image / combine with next frame*/DoNotDispose:1,
    /**restore to background color > opaque frame pixels get filled with background color or cleared (when it's the same as {@linkcode Frame.transparentColorIndex})*/RestoreBackgroundColor:2,
    /**restore to previous > dispose frame data after rendering (revealing what was there before)*/RestorePrevious:3,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedA:4,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedB:5,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedC:6,
    /**undefined > fallback to {@linkcode DisposalMethod.Unspecified}*/UndefinedD:7,
});
/**
 * ## Decodes a GIF into its components for rendering on a canvas
 * @param {string} gifURL - the URL of a GIF file
 * @param {InterruptSignal} interruptSignal - pause/aboard fetching/parsing with this (via {@linkcode Interrupt})
 * @param {(byteLength:number)=>(Promise<boolean>|boolean)} [sizeCheck] - Optional check if the loaded file should be processed if this yields `false` then it will reject with `file to large`
 * @param {(percentageRead:number,frameIndex:number,frame:ImageData,framePos:[number,number],gifSize:[number,number])=>any} [progressCallback] - Optional callback for showing progress of decoding process (each frame) - if asynchronous, it waits for it to resolve before continuing decoding
 * @returns {Promise<GIF>} the GIF with each frame decoded separately - may reject (throw) for the following reasons
 * - {@linkcode interruptSignal} reference, when it triggers
 * - fetch errors when trying to fetch the GIF from {@linkcode gifURL}:
 * - - `fetch error: network error`
 * - - `fetch error (connecting)` any unknown error during {@linkcode fetch}
 * - - `fetch error: recieved STATUS_CODE` when URL yields a status code that's NOT between 200 and 299 (inclusive)
 * - - `fetch error: could not read resource`
 * - - `fetch error: resource to large` (not from {@linkcode sizeCheck})
 * - - `fetch error (reading)` any unknown error during {@linkcode Response.arrayBuffer}
 * - `file to large` when {@linkcode sizeCheck} yields `false`
 * - `not a supported GIF file` when it's not a GIF file or the version is NOT `GIF89a`
 * - `error while parsing frame [INDEX] "ERROR"` while decoding GIF - one of the following
 * - - `GIF frame size is to large`
 * - - `plain text extension without global color table`
 * - - `undefined block found`
 * - - `reading out of range` (unexpected end of file during decoding)
 * - - `unknown error`
 * @throws {TypeError} if {@linkcode gifURL} is not a string; {@linkcode interruptSignal} is not an interrupt signal; or {@linkcode sizeCheck} or {@linkcode progressCallback} are given but aren't functions
 */
export const decodeGIF=async(gifURL,interruptSignal,sizeCheck,progressCallback)=>{
    if(typeof gifURL!=="string")throw new TypeError("[decodeGIF] gifURL is not a string.");
    if(!Interrupt.isSignal(interruptSignal))throw new TypeError("[decodeGIF] interruptSignal is not an interrupt signal.");
    if(sizeCheck!=null&&typeof sizeCheck!=="function")throw new TypeError("[decodeGIF] sizeCheck is not a function.");
    if(progressCallback!=null&&typeof progressCallback!=="function")throw new TypeError("[decodeGIF] progressCallback is not a function.");
    if(await interruptSignal.check())throw interruptSignal;
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
     * @throws {RangeError} if any method tries to read out of bounds
     */
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
     * ### Get a color table of length {@linkcode count}
     * @param {ByteStream} byteStream - GIF data stream
     * @param {number} count - number of colours to read from {@linkcode byteStream}
     * @returns {[number,number,number][]} an array of RGB color values
     */
    const parseColorTable=(byteStream,count)=>{
        /**@type {[number,number,number][]}*/
        const colors=[];
        for(let i=0;i<count;++i){
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
     * ### Parsing one block from GIF data stream
     * @param {ByteStream} byteStream - GIF data stream
     * @param {GIF} gif - GIF object to write to
     * @param {(increment?:boolean)=>number} getFrameIndex - function to get current frame index in {@linkcode GIF.frames} (optionally increment before next cycle)
     * @param {(replace?:string)=>string} getLastBlock - function to get last block read (optionally replace for next call)
     * @returns {Promise<boolean>} true if EOF was reached
     * @throws {EvalError} for the following reasons
     * - GIF frame size is to large
     * - plain text extension without global color table
     * - undefined block found
     * - unknown error
     * @throws {RangeError} if {@linkcode byteStream} throws for out of bounds reading
     * @throws {typeof interruptSignal} if {@linkcode interruptSignal} triggered
     */
    const parseBlock=async(byteStream,gif,getFrameIndex,getLastBlock)=>{
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
                 * #### Get color from color tables (transparent if {@linkcode index} is equal to the transparency index)
                 * uses local color table and fallback to global color table if {@linkcode index} is out of range or no local color table is present
                 * @param {number} index - index into global/local color table
                 * @returns {[number,number,number,number]} RGBA color value
                 */
                const getColor=index=>{
                    const[R,G,B]=localColorTableFlag&&index<frame.localColorTable.length?frame.localColorTable[index]:gif.globalColorTable[index];
                    return[R,G,B,index===frame.transparentColorIndex?0:255];
                }
                const image=(()=>{
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
                 * #### Read {@linkcode len} bits from {@linkcode imageData} at {@linkcode pos}
                 * @param {number} pos - bit position in {@linkcode imageData}
                 * @param {number} len - bit length to read [1 to 12 bits]
                 * @returns {number} - {@linkcode len} bits at {@linkcode pos}
                 */
                const readBits=(pos,len)=>{
                    const bytePos=pos>>>3,
                        bitPos=pos&7;
                    return((imageData[bytePos]+(imageData[bytePos+1]<<8)+(imageData[bytePos+2]<<16))&(((1<<len)-1)<<bitPos))>>>bitPos;
                };
                if(interlacedFlag){
                    for(let code=0,size=minCodeSize+1,pos=0,dic=[[0]],pixelPos=0,lineIndex=0,pass=0;pass<4;){
                        if(InterlaceOffsets[pass]>=frame.height){
                            ++pass;
                            pixelPos=0;
                            lineIndex=0;
                            continue;
                        }
                        const last=code;
                        code=readBits(pos,size);
                        pos+=size;
                        if(code===clearCode){
                            size=minCodeSize+1;
                            dic.length=clearCode+2;
                            for(let i=0;i<dic.length;++i)dic[i]=i<clearCode?[i]:[];
                        }else{
                            //~ clear code +1 = end of information code
                            if(code===clearCode+1)break;
                            if(code>=dic.length)dic.push(dic[last].concat(dic[last][0]));
                            else if(last!==clearCode)dic.push(dic[last].concat(dic[code][0]));
                            for(let i=0;i<dic[code].length;++i){
                                image.data.set(getColor(dic[code][i]),frame.width*4*(InterlaceOffsets[pass]+lineIndex*InterlaceSteps[pass])+pixelPos);
                                if((pixelPos+=4)>=frame.width*4){
                                    pixelPos%=frame.width*4;
                                    if(InterlaceOffsets[pass]+InterlaceSteps[pass]*++lineIndex>=frame.height){
                                        //// await progressCallback?.((byteStream.pos+1+pos/8-imageData.length)/byteStream.data.length,getFrameIndex(),image,[frame.left,frame.top],[gif.width,gif.height]);
                                        ++pass;
                                        pixelPos=0;
                                        lineIndex=0;
                                    }
                                }
                            }
                            if(dic.length>=(1<<size)&&size<12)++size;
                        }
                        if(InterlaceOffsets[pass]+InterlaceSteps[pass]*lineIndex>=frame.height){
                            //// await progressCallback?.((byteStream.pos+1+pos/8-imageData.length)/byteStream.data.length,getFrameIndex(),image,[frame.left,frame.top],[gif.width,gif.height]);
                            ++pass;
                            pixelPos=0;
                            lineIndex=0;
                        }
                        if(await interruptSignal.check())throw interruptSignal;
                    }
                    await progressCallback?.((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),frame.image=image,[frame.left,frame.top],[gif.width,gif.height]);
                }else{
                    for(let code=0,size=minCodeSize+1,pos=0,dic=[[0]],pixelPos=-4;true;){
                        const last=code;
                        code=readBits(pos,size);
                        pos+=size;
                        if(code===clearCode){
                            size=minCodeSize+1;
                            dic.length=clearCode+2;
                            for(let i=0;i<dic.length;++i)dic[i]=i<clearCode?[i]:[];
                        }else{
                            //~ clear code +1 = end of information code
                            if(code===clearCode+1)break;
                            if(code>=dic.length)dic.push(dic[last].concat(dic[last][0]));
                            else if(last!==clearCode)dic.push(dic[last].concat(dic[code][0]));
                            for(let i=0;i<dic[code].length;++i)image.data.set(getColor(dic[code][i]),pixelPos+=4);
                            if(dic.length>=(1<<size)&&size<12)++size;
                        }
                    }
                    await progressCallback?.((byteStream.pos+1)/byteStream.data.length,getFrameIndex(),frame.image=image,[frame.left,frame.top],[gif.width,gif.height]);
                    if(await interruptSignal.check())throw interruptSignal;
                }
                getLastBlock(`frame [${getFrameIndex()}]`);
            break;
            case GIFDataHeaders.Extension:
                switch(byteStream.nextByte()){
                    case GIFDataHeaders.GraphicsControlExtension:
                        //~ parse graphics control extension data - applies to the next frame in the byte stream
                        const frame=gif.frames[getFrameIndex()];
                        //~ block size (1B) - static 4 - byte size of the block up to (but excluding) the Block Terminator
                        ++byteStream.pos;
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
                        frame.delayTime=byteStream.nextTwoBytes()*10;
                        //~ transparency index (1B) - color index of transparent color for following frame (only use if transparency flag is set - byte is always present)
                        if(transparencyFlag)frame.transparentColorIndex=byteStream.nextByte();
                        else ++byteStream.pos;
                        //~ block terminator (1B) - static 0 - marks end of graphics control extension block
                        ++byteStream.pos;
                        getLastBlock(`graphics control extension for frame [${getFrameIndex()}]`);
                    break;
                    case GIFDataHeaders.ApplicationExtension:
                        //~ parse application extension - application-specific information
                        /**@type {ApplicationExtension}*/
                        const applicationExtension={};
                        //~ block size (1B) - static 11 - byte size of the block up to (but excluding) the application data blocks
                        ++byteStream.pos;
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
                        ++byteStream.pos;
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
                        getLastBlock(`unknown extension [${gif.unknownExtensions.length}] #${extID.toString(16).toUpperCase().padStart(2,'0')}`);
                        //~ read unknown extension with unknown length
                        gif.unknownExtensions.push([extID,byteStream.readSubBlocksBin()]);
                    break;
                }
            break;
            default:throw new EvalError("undefined block found");
        }
        return false;
    }
    const response=await fetch(gifURL,{credentials:"omit",referrer:"",signal:interruptSignal.signal}).catch(err=>{
        if(err===interruptSignal)throw interruptSignal;
        if(err instanceof TypeError)throw"fetch error: network error";
        throw"fetch error (connecting)";
    });
    if(response.redirected)console.info("Got redirected to: %s",response.url);
    if(!response.ok)throw`fetch error: recieved ${response.status}`;
    const raw=await response.arrayBuffer().catch(err=>{
        if(err instanceof DOMException&&err.name==="AbortError")throw interruptSignal;
        if(err instanceof TypeError)throw"fetch error: could not read resource";
        if(err instanceof RangeError)throw"fetch error: resource to large";
        throw"fetch error (reading)";
    });
    if(!(await(sizeCheck?.(raw.byteLength)??true)))throw"file to large";
    /**@type {ByteStream}*/
    const byteStream=Object.preventExtensions({
        len:raw.byteLength,
        pos:0,
        data:new Uint8ClampedArray(raw),
        nextByte(){
            if(this.pos>=this.len)throw new RangeError("reading out of range");
            return this.data[this.pos++];
        },
        nextTwoBytes(){
            if((this.pos+=2)>this.len)throw new RangeError("reading out of range");
            return this.data[this.pos-2]+(this.data[this.pos-1]<<8);
        },
        getString(count){
            if(this.pos+count>this.len)throw new RangeError("reading out of range");
            let s="";
            for(;--count>=0;s+=String.fromCharCode(this.data[this.pos++]));
            return s;
        },
        readSubBlocks(){
            let blockString="",size=0;
            do{
                size=this.data[this.pos];
                if((this.pos++)+size>this.len)throw new RangeError("reading out of range");
                for(let count=size;--count>=0;blockString+=String.fromCharCode(this.data[this.pos++]));
            }while(size!==0);
            return blockString;
        },
        readSubBlocksBin(){
            let size=0,len=0;
            for(let offset=0;(size=this.data[this.pos+offset])!==0;offset+=size+1){
                if(this.pos+offset>this.len)throw new RangeError("reading out of range");
                len+=size;
            }
            const blockData=new Uint8Array(len);
            for(let i=0;(size=this.data[this.pos++])!==0;)
                for(let count=size;--count>=0;blockData[i++]=this.data[this.pos++]);
            return blockData;
        },
        skipSubBlocks(){
            for(;this.data[this.pos]!==0;this.pos+=this.data[this.pos]+1);
            if(++this.pos>this.len)throw new RangeError("reading out of range");
        }
    });
    if(await interruptSignal.check())throw interruptSignal;
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
    };
    //~ signature (3B) and version (3B)
    if(byteStream.getString(6)!=="GIF89a")throw"not a supported GIF file";
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
    else ++byteStream.pos;
    //~ pixel aspect ratio (1B) - if non zero the pixel aspect ratio will be `(value + 15) / 64` from 4:1 to 1:4 in 1/64th increments
    gif.pixelAspectRatio=byteStream.nextByte();
    if(gif.pixelAspectRatio!==0)gif.pixelAspectRatio=(gif.pixelAspectRatio+15)/64;
    //~ parse global color table if there is one
    if(globalColorTableFlag)gif.globalColorTable=parseColorTable(byteStream,globalColorCount);
    //~ parse other blocks ↓
    let frameIndex=-1,
        incrementFrameIndex=true,
        lastBlock="parsing global GIF info";
    /**
     * ### Get the index of the current frame
     * @param {boolean} [increment] - if the frame index should increse before the next cycle - default `false`
     * @returns {number} current frame index
     */
    const getframeIndex=increment=>{
        if(increment??false)incrementFrameIndex=true;
        return frameIndex;
    };
    /**
     * ### Get the last block parsed
     * @param {string} [replace] - if given replaces the current "last block" value with this
     * @returns {string} last block parsed
     */
    const getLastBlock=replace=>{
        if(replace==null)return lastBlock;
        return lastBlock=replace;
    };
    try{
        do{
            if(await interruptSignal.check())throw interruptSignal;
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
                ++frameIndex;
                incrementFrameIndex=false;
            }
        }while(!await parseBlock(byteStream,gif,getframeIndex,getLastBlock));
        --gif.frames.length;
        for(const frame of gif.frames){
            //~ set total time to infinity if the user input delay flag is set and there is no timeout
            if(frame.userInputDelayFlag&&frame.delayTime===0){
                gif.totalTime=Infinity;
                break;
            }
            gif.totalTime+=frame.delayTime;
        }
        return gif;
    }catch(err){throw err===interruptSignal?interruptSignal:`error while parsing frame [${frameIndex}] "${(err instanceof EvalError)||(err instanceof RangeError)?err.message:"unknown error"}"`;}
};
/**
 * ## Extract the animation loop amount from a {@linkcode GIF}
 * Generally, for proper looping support, the `NETSCAPE2.0` extension must appear immediately after the global color table of the logical screen descriptor (at the beginning of the GIF file). Still, here, it doesn't matter where it was found.
 * @param {GIF} gif - a parsed GIF object
 * @returns {number} the loop amount of {@linkcode gif} as 16bit number (0 to 65'535 or `Infinity`)
 */
export const getGIFLoopAmount=gif=>{
    for(const ext of gif.applicationExtensions)
        if(ext.authenticationCode==="2.0"&&ext.identifier==="NETSCAPE"){
            const loop=ext.data[1]+(ext.data[2]<<8);
            if(loop===0)return Infinity;
            return loop;
        }
    return 0;
};
