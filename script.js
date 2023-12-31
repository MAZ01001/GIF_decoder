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
 * @property {number} totalTime the total duration of the gif in milliseconds (all delays added together) - will be `Infinity` if there is a frame with the user input delay flag set and no timeout
 * @property {number} colorRes the color depth/resolution in bits per color (in the original) [1-8 bits]
 * @property {number} pixelAspectRatio if non zero the pixel aspect ratio will be from 4:1 to 1:4 in 1/64th increments
 * @property {boolean} sortFlag if the colors in the global color table are ordered after decreasing importance
 * @property {[number,number,number][]} globalColorTable the global color table for the GIF
 * @property {ImageData} backgroundImage an image filled with the background color (can be used as a background before the first frame) - if the global color table is not available this is transparent black
 * @property {Frame[]} frames each frame of the GIF (decoded into single images)
 * @property {[number,string][]} comments comments in the file and on with frame they where found
 * @property {ApplicationExtension[]} applicationExtensions all application extensions found
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
 * @property {ImageData} image this frames image data
 * @property {PlainTextData|null} plainTextData the text that will be displayed on screen with this frame (if not null)
 * @property {boolean} userInputDelayFlag if set waits for user input before rendering the next frame (timeout after delay if that is non-zero)
 * @property {number} delayTime the delay of this frame in milliseconds
 * @property {boolean} sortFlag if the colors in the local color table are ordered after decreasing importance
 * @property {[number,number,number][]} localColorTable the local color table for this frame
 * @property {number} reserved _reserved for future use_ (from packed field in image descriptor block)
 * @property {number} GCreserved _reserved for future use_ (from packed field in graphics control extension block)
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
/**@enum {number}*/
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
 * __decodes a GIF into its components for rendering on a canvas__
 * @param {string} gifURL - the URL of a GIF file
 * @param {(percentageRead:number,frameCount:number,lastFrame:ImageData,framePos:[number,number],gifSize:[number,number])=>any} progressCallback - callback for showing progress of decoding process (when GIF is interlaced calls after each pass (4x on the same frame))
 * @param {boolean?} avgAlpha - [optional] if this is true then, when encountering a transparent pixel, it uses the average value of the pixels RGB channels to calculate the alpha channels value, otherwise alpha channel is either 0 or 1 - _default false_
 * @returns {Promise<GIF>} the GIF with each frame decoded separately
 */
const decodeGIF=async(gifURL,progressCallback,avgAlpha)=>{
    "use strict";
    if(avgAlpha==null||typeof avgAlpha!=="boolean")avgAlpha=false;
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
     * __get a color table of length `count`__
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
     * __parsing one block in GIF data stream__
     * @param {ByteStream} byteStream - GIF data stream
     * @param {GIF} gif - GIF object to write to
     * @param {(increment:boolean)=>number} getFrameIndex - function to get current frame index in `GIF.frames` (optionally increment before next call)
     * @param {(newValue:number?)=>number} getTransparencyIndex - function to get current transparency index into global/local color table (optionally update value)
     * @returns {Promise<boolean>} true if EOF was reached
     * @throws {EvalError}
     */
    const parseBlock=async(byteStream,gif,getFrameIndex,getTransparencyIndex)=>{
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
                 * __get color from color tables (transparent if index is equal to the transparency index)__
                 * @param {number} index - index into global/local color table
                 * @returns {[number,number,number,number]} RGBA color value
                 */
                const getColor=index=>{
                    "use strict";
                    const[R,G,B]=(localColorTableFlag?frame.localColorTable:gif.globalColorTable)[index];
                    return[R,G,B,index===getTransparencyIndex(null)?(avgAlpha?~~((R+G+B)/3):0):255];
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
                 * __read `len` bits from `imageData` at `pos`__
                 * @param {number} pos - bit position in `imageData`
                 * @param {number} len - bit length to read [1-12 bits]
                 * @returns {number} `len` bits at `pos`
                 */
                const readBits=(pos,len)=>{
                    "use strict";
                    const bytePos=pos>>>3,
                        bitPos=pos&7;
                    return((imageData[bytePos]+(imageData[bytePos+1]<<8)+(imageData[bytePos+2]<<16))&(((1<<len)-1)<<bitPos))>>>bitPos;
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
                        progressCallback(byteStream.pos/(byteStream.data.length-1),getFrameIndex(false)+1,image,[frame.left,frame.top],[gif.width,gif.height]);
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
                    progressCallback((byteStream.pos+1)/byteStream.data.length,getFrameIndex(false)+1,frame.image=image,[frame.left,frame.top],[gif.width,gif.height]);
                }
            break;
            case GIFDataHeaders.Extension:
                switch(byteStream.nextByte()){
                    case GIFDataHeaders.GraphicsControlExtension:
                        //~ parse graphics control extension data - applies to the next frame in the byte stream
                        const frame=gif.frames[getFrameIndex(false)];
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
                        //~ > transparent color flag (1b) - idicates that, if set, the following transparency index should be used to ignore each color with this index in the following frame
                        const transparencyFlag=(packedByte&1)===1;
                        //~ delay time (2B) - if non-zero specifies the number of 1/100 seconds (here converted to milliseconds) to delay (rendering of) the following frame
                        frame.delayTime=byteStream.nextTwoBytes()*0xA;
                        //~ transparency index (1B) - color index of transparent color for following frame (only if transparency flag is set)
                        const transparencyIndex=byteStream.nextByte();
                        if(transparencyFlag)getTransparencyIndex(transparencyIndex);
                        //~ block terminator (1B) - static 0 - marks end of graphics control extension block
                        byteStream.pos++;
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
                        gif.applicationExtensions.push(applicationExtension);
                    break;
                    case GIFDataHeaders.CommentExtension:
                        //~ parse comment extension - one or more blocks each stating their size (1B) [1-255]
                        gif.comments.push([getFrameIndex(false),byteStream.readSubBlocks()]);
                    break;
                    case GIFDataHeaders.PlainTextExtension:
                        //~ parse plain text extension - text to render with the following frame (uses global color table)
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
                        gif.frames[getFrameIndex(false)].plainTextData=plainTextData;
                    break;
                    default:
                        //~ skip unknown extensions
                        byteStream.skipSubBlocks();
                    break;
                }
            break;
            default:throw new EvalError("undefined block found");
        }
        return false;
    }
    return new Promise((resolve,reject)=>{
        const ajax=new XMLHttpRequest();
        ajax.responseType="arraybuffer";
        ajax.onload=async()=>{
            if(ajax.status===404)reject("file not found");
            else if(ajax.status>=200&&ajax.status<300){
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
                        backgroundImage:new ImageData(1,1,{colorSpace:"srgb"}),
                        comments:[],
                        applicationExtensions:[]
                    },
                    byteStream=newByteStream(ajax.response);
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
                //~ background color index (1B) - when global color table exists this points to the color (index) that should be used for pixels without color data
                const backgroundColorIndex=byteStream.nextByte();
                //~ pixel aspect ratio (1B) - if non zero the pixel aspect ratio will be `(value + 15) / 64` from 4:1 to 1:4 in 1/64th increments
                gif.pixelAspectRatio=byteStream.nextByte();
                if(gif.pixelAspectRatio!==0)gif.pixelAspectRatio=(gif.pixelAspectRatio+0xF)/0x40;
                //~ parse global color table if there is one
                if(globalColorTableFlag)gif.globalColorTable=parseColorTable(byteStream,globalColorCount);
                //~ set background image / background color or transparent
                const backgroundImage=(()=>{
                    "use strict";
                    try{return new ImageData(gif.width,gif.height,{colorSpace:"srgb"});}
                    catch(error){
                        if(error instanceof DOMException&&error.name==="IndexSizeError")return null;
                        throw error;
                    }
                })();
                if(backgroundImage==null){reject("GIF frame size is to large");return;}
                backgroundImage.data.set(globalColorTableFlag?[...gif.globalColorTable[backgroundColorIndex],255]:[0,0,0,0]);
                for(let i=4;i<backgroundImage.data.length;i*=2)backgroundImage.data.copyWithin(i,0,i);
                gif.backgroundImage=backgroundImage;
                //~ parse other blocks >
                let frameIndex=-1,
                    incrementFrameIndex=true,
                    transparencyIndex=-1;
                /**
                 * __get the index of the current frame__
                 * @param {boolean} increment - if the frame index should increse before the next iterration
                 * @returns {number} current frame index
                 */
                const getframeIndex=(increment)=>{
                    "use strict";
                    if(increment)incrementFrameIndex=true;
                    return frameIndex;
                };
                /**
                 * __get the current transparency index for this frame__
                 * @param {number?} newValue - if set updates value of transparencyIndex to this
                 * @returns {number} current transparency index
                 */
                const getTransparencyIndex=(newValue)=>{
                    "use strict";
                    if(newValue!=null)transparencyIndex=newValue;
                    return transparencyIndex;
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
                            transparencyIndex=-1;
                            incrementFrameIndex=false;
                        }
                    }while(!await parseBlock(byteStream,gif,getframeIndex,getTransparencyIndex));
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
                    if(error instanceof EvalError){reject(`error while parsing frame ${frameIndex} "${error.message}"`);return;}
                    throw error;
                }
            }else reject("loading error");
        };
        ajax.onerror=()=>reject("file error");
        ajax.onabort=()=>reject("loading aborted");
        ajax.open('GET',gifURL,true);
        ajax.send();
    });
};
/**
 * __extract the animation loop amount from `gif`__
 * @param {GIF} gif - a parsed GIF object
 * @returns {number} - if `NETSCAPE2.0` is available, the loop amount of the GIF as 16bit number (0 = infinity), otherwise `NaN`
 */
const getGIFLoopAmount=gif=>{
    for(const extension of gif.applicationExtensions){
        if(extension.identifier+extension.authenticationCode!=="NETSCAPE2.0")continue;
        return extension.data[1]+(extension.data[2]<<8);
    }
    return NaN;
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
    root: document.documentElement,
    /** @type {HTMLDivElement} Main container *///@ts-ignore element does exist in DOM
    box: document.getElementById("box"),
    /** @type {HTMLHeadingElement} Main page heading (element before {@linkcode html.view.view}) *///@ts-ignore element does exist in DOM
    heading: document.getElementById("gifHeading"),
    /** GIF view box */
    view: Object.freeze({
        /** @type {HTMLDivElement} View box container *///@ts-ignore element does exist in DOM
        view: document.getElementById("gifView"),
        /** @type {HTMLDivElement} container for the {@linkcode html.view.htmlCanvas} controls *///@ts-ignore element does exist in DOM
        controls: document.getElementById("gifViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.view.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow: document.getElementById("fullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 fit to {@linkcode html.view.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow: document.getElementById("fitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.view.htmlCanvas} between 0 pixelated `🙾` and 1 smooth `🙼` (default) image rendering via class `pixel` *///@ts-ignore element does exist in DOM
        imgSmoothing: document.getElementById("imgSmoothing"),
        /** @type {HTMLCanvasElement} The main GIF canvas (HTML) *///@ts-ignore element does exist in DOM
        htmlCanvas: document.getElementById("htmlCanvas"),
        /** @type {CanvasRenderingContext2D} The main GIF canvas (2D context of {@linkcode html.view.htmlCanvas}) *///@ts-ignore element does exist in DOM
        canvas: document.getElementById("htmlCanvas").getContext("2d",{colorSpace:"srgb"})
    }),
    /** GIF controls (under {@linkcode html.view.view}) */
    controls: Object.freeze({
        /** @type {HTMLInputElement} Disabled slider for GIF time progress in milliseconds (uses tickmarks of {@linkcode html.controls.timeTickmarks}) *///@ts-ignore element does exist in DOM
        timeRange: document.getElementById("timeRange"),
        /** @type {HTMLSpanElement} Displays current timestamp of GIF playback in milliseconds (next to {@linkcode html.controls.timeRange}) *///@ts-ignore element does exist in DOM
        time: document.getElementById("time"),
        /** @type {HTMLDataListElement} List of timestamps (milliseconds) for tickmarks under {@linkcode html.controls.timeRange} (`<option>MS_TIMESTAMP</option>`) *///@ts-ignore element does exist in DOM
        timeTickmarks: document.getElementById("timeTickmarks"),
        /** @type {HTMLInputElement} Interactible slider for frame selection *///@ts-ignore element does exist in DOM
        frameRange: document.getElementById("frameRange"),
        /** @type {HTMLSpanElement} Displays current frame index (next to {@linkcode html.controls.frameRange}) *///@ts-ignore element does exist in DOM
        frame: document.getElementById("frame"),
        /** @type {HTMLInputElement} Button to go to the first frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekStart: document.getElementById("seekStart"),
        /** @type {HTMLInputElement} Button to go to the previous frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekPrevious: document.getElementById("seekPrevious"),
        /** @type {HTMLInputElement} Button to play GIF in reverse *///@ts-ignore element does exist in DOM
        reverse: document.getElementById("reverse"),
        /** @type {HTMLInputElement} Button to pause GIF playback *///@ts-ignore element does exist in DOM
        pause: document.getElementById("pause"),
        /** @type {HTMLInputElement} Button to start GIF playback *///@ts-ignore element does exist in DOM
        play: document.getElementById("play"),
        /** @type {HTMLInputElement} Button to go to the next frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekNext: document.getElementById("seekNext"),
        /** @type {HTMLInputElement} Button to go to the last frame of the GIF (and pause playback) *///@ts-ignore element does exist in DOM
        seekEnd: document.getElementById("seekEnd"),
        /** @type {HTMLFieldSetElement} Container for user input controls (highlight via class `waiting` when waiting for user input) *///@ts-ignore element does exist in DOM
        userInputField: document.getElementById("userInputField"),
        /** @type {HTMLInputElement} Disabled slider to show timeout (milliseconds) for user input delay (use class `infinity` if this frame has no timeout and `none` if this frame does not need user input) *///@ts-ignore element does exist in DOM
        userInputTimeout: document.getElementById("userInputTimeout"),
        /** @type {HTMLSpanElement} Shows timeout for user input in milliseconds (see {@linkcode html.controls.userInputTimeout}) *///@ts-ignore element does exist in DOM
        userInputTimeoutTime: document.getElementById("userInputTimeoutTime"),
        /** @type {HTMLInputElement} Button to `data-toggle` user input lock (1 ON / 0 OFF (default)) if ON, does not wait and continues playback instantly *///@ts-ignore element does exist in DOM
        userInputLock: document.getElementById("userInputLock"),
        /** @type {HTMLInputElement} Button for user input, continues playback when waiting for user input *///@ts-ignore element does exist in DOM
        userInput: document.getElementById("userInput")
    }),
    /** @type {HTMLDivElement} Main info panel container *///@ts-ignore element does exist in DOM
    infoPanels: document.getElementById("infoPanels"),
    /** @type {HTMLInputElement} Button that opens the {@linkcode html.import.menu} (at the top of {@linkcode html.infoPanels}) *///@ts-ignore element does exist in DOM
    open: document.getElementById("open"),
    /** GIF info panel (collapsable) */
    info: Object.freeze({
        /** @type {HTMLTableCellElement} Shows the name of the GIF file *///@ts-ignore element does exist in DOM
        fileName: document.getElementById("fileName"),
        /** @type {HTMLSpanElement} Shows the total width of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        totalWidth: document.getElementById("totalWidth"),
        /** @type {HTMLSpanElement} Shows the total height of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        totalHeight: document.getElementById("totalHeight"),
        /** @type {HTMLTableCellElement} Shows the total number of frames of the GIF *///@ts-ignore element does exist in DOM
        totalFrames: document.getElementById("totalFrames"),
        /** @type {HTMLTableCellElement} Shows the total time of the GIF (in milliseconds) *///@ts-ignore element does exist in DOM
        totalTime: document.getElementById("totalTime"),
        /** @type {HTMLTableCellElement} Shows the pixel ascpect ratio of the GIF (in format `w:h` ie. `1:1`) *///@ts-ignore element does exist in DOM
        pixelAspectRatio: document.getElementById("pixelAspectRatio"),
        /** @type {HTMLTableCellElement} Shows the color resolution of the GIF (in bits) *///@ts-ignore element does exist in DOM
        colorRes: document.getElementById("colorRes"),
        /** @type {HTMLDivElement} List of colors in the global color table of the GIF (`<label title="Color index I">[I] <input type="color" disabled></label>` (optionaly with class `background-flag` / `transparent-flag` and addition to title) for each color or `<span>Empty list (see local color tables)</span>`) *///@ts-ignore element does exist in DOM
        globalColorTable: document.getElementById("globalColorTable"),
        /** @type {HTMLDivElement} List of GIF application extensions in RAW binary (`<fieldset><legend title="Application-Extension identifier (8 characters) and authentication code (3 characters)"><span>APPLICAT</span> <span>1.0</span></legend><span title="Description">unknown extension</span> <input type="button" title="Click to copy raw binary to clipboard" value="Copy raw binary"></fieldset>` for each app. ext. or `<span>Empty list</span>`) *///@ts-ignore element does exist in DOM
        appExtList: document.getElementById("appExtList")
    }),
    /** GIF frame info panel (collapsable) */
    frame: Object.freeze({
        /** @type {HTMLElement} Summary of collapsable frame view (element before {@linkcode html.frame.view}) *///@ts-ignore element does exist in DOM
        viewContainerSummary: document.getElementById("frameViewSummary"),
        /** @type {HTMLDivElement} Collapsable (frame) view box container *///@ts-ignore element does exist in DOM
        view: document.getElementById("frameView"),
        /** @type {HTMLDivElement} container for the {@linkcode html.frame.hmtlCanvas} controls *///@ts-ignore element does exist in DOM
        controls: document.getElementById("frameViewButtons"),
        /** @type {HTMLInputElement} Button to `data-toggle` scale {@linkcode html.frame.view} to browser width (on `⤢` off `🗙`) via class `full` *///@ts-ignore element does exist in DOM
        fullWindow: document.getElementById("frameFullWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 fit to {@linkcode html.frame.view} `🞕` (default) and 1 actual size `🞑` (pan with drag controls `margin-left` & `-top` ("__px") (_offset to max half of canvas size_) and zoom `--scaler` (float)) via class `real` (and update `--canvas-width` ("__px")) *///@ts-ignore element does exist in DOM
        fitWindow: document.getElementById("frameFitWindow"),
        /** @type {HTMLInputElement} Button to `data-toggle` {@linkcode html.frame.htmlCanvas} between 0 pixelated `🙾` and 1 smooth `🙼` (default) image rendering via class `pixel` *///@ts-ignore element does exist in DOM
        imgSmoothing: document.getElementById("frameImgSmoothing"),
        /** @type {HTMLCanvasElement} The frame canvas (HTML) for the current frame *///@ts-ignore element does exist in DOM
        htmlCanvas: document.getElementById("htmlFrameCanvas"),
        /** @type {CanvasRenderingContext2D} The frame canvas (2D context of {@linkcode html.frame.htmlCanvas}) for the current frame *///@ts-ignore element does exist in DOM
        canvas: document.getElementById("htmlFrameCanvas").getContext("2d",{colorSpace:"srgb"}),
        /** @type {HTMLSpanElement} Shows the width of the current frame (in pixels) *///@ts-ignore element does exist in DOM
        width: document.getElementById("frameWidth"),
        /** @type {HTMLSpanElement} Shows the height of the current frame (in pixels) *///@ts-ignore element does exist in DOM
        height: document.getElementById("frameHeight"),
        /** @type {HTMLSpanElement} Shows the position of the current frame from the left edge of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        left: document.getElementById("frameLeft"),
        /** @type {HTMLSpanElement} Shows the position of the current frame from the top edge of the GIF (in pixels) *///@ts-ignore element does exist in DOM
        top: document.getElementById("frameTop"),
        /** @type {HTMLSpanElement} Shows the time in milliseconds this frame is displayed for *///@ts-ignore element does exist in DOM
        time: document.getElementById("frameTime"),
        /** @type {HTMLInputElement} Disabled checkbox to show if this frame is waiting for user input *///@ts-ignore element does exist in DOM
        userInputFlag: document.getElementById("frameUserInputFlag"),
        /** @type {HTMLTableCellElement} Readonly, shows the disposal method of the current frame (index, text, and meaning) *///@ts-ignore element does exist in DOM
        disposalMethod: document.getElementById("frameDisposalMethod"),
        /** @type {HTMLTextAreaElement} Readonly, shows comment for the current frame (if found or use class `empty`) *///@ts-ignore element does exist in DOM
        comment: document.getElementById("frameComment"),
        /** @type {HTMLDivElement} List of colors in the local color table of the current frame (`<label title="Color index I">[I] <input type="color"></label>` (optionaly with class `background-flag` / `transparent-flag` and addition to title) for each color or `<span>Empty list (see global color table)</span>`) *///@ts-ignore element does exist in DOM
        localColorTable: document.getElementById("frameColorTable"),
        /**
         * Text information for this frame
         * - characters other than `0x20` to `0xF7` are interpreted as `0x20`
         * - each character is rendered seperatly (in one cell each)
         * - monospace font, size to cell height / width (measure font character w/h aspect and fit it to width if it's smaller)
         * - cells are tiled from tp left, to right, then bottom (fractional cells are skiped)
         * - if grid is filled and there are characters left, ignore them
         */
        text: Object.freeze({
            /** @type {HTMLDivElement} The text extension container (add class `empty` if current frame doesn't have a text extension) *///@ts-ignore element does exist in DOM
            area: document.getElementById("frameTextArea"),
            /** @type {HTMLTableCellElement} The text to display on top of the current frame *///@ts-ignore element does exist in DOM
            text: document.getElementById("frameText"),
            /** Grid information of this text */
            grid: Object.freeze({
                /** @type {HTMLSpanElement} The width of the text grid in pixels *///@ts-ignore element does exist in DOM
                width: document.getElementById("frameTextWidth"),
                /** @type {HTMLSpanElement} The height of the text grid in pixels *///@ts-ignore element does exist in DOM
                height: document.getElementById("frameTextHeight"),
                /** @type {HTMLSpanElement} The (top left) position of the text grid from the left edge of the GIF (logical screen) in pixels *///@ts-ignore element does exist in DOM
                left: document.getElementById("frameTextLeft"),
                /** @type {HTMLSpanElement} The (top left) position of the text grid from the top edge of the GIF (logical screen) in pixels *///@ts-ignore element does exist in DOM
                top: document.getElementById("frameTextTop")
            }),
            /** Cell information of this text */
            cell: Object.freeze({
                /** @type {HTMLSpanElement} The width of each character cell in pixels (should tile the text grid perfectly) *///@ts-ignore element does exist in DOM
                width: document.getElementById("frameTextCharWidth"),
                /** @type {HTMLSpanElement} The height of each character cell in pixels (should tile the text grid perfectly) *///@ts-ignore element does exist in DOM
                height: document.getElementById("frameTextCharHeight"),
            }),
            /** @type {HTMLInputElement} The foreground color of this text (index into global color table) *///@ts-ignore element does exist in DOM
            foreground: document.getElementById("frameTextCharForeground"),
            /** @type {HTMLInputElement} The background color of this text (index into global color table) *///@ts-ignore element does exist in DOM
            background: document.getElementById("frameTextCharBackground")
        })
    }),
    /** Import menu */
    import: Object.freeze({
        /** @type {HTMLDialogElement} The import menu element (use this to open or close dialog box) *///@ts-ignore element does exist in DOM
        menu: document.getElementById("importMenu"),
        /** @type {HTMLInputElement} The URL input field (deactivate this if {@linkcode html.import.file} is used) *///@ts-ignore element does exist in DOM
        url: document.getElementById("importURL"),
        /** @type {HTMLInputElement} The file input field (deactivate this if {@linkcode html.import.url} is used) *///@ts-ignore element does exist in DOM
        file: document.getElementById("importFile"),
        /** @type {HTMLImageElement} The IMG preview of the imported GIF *///@ts-ignore element does exist in DOM
        preview: document.getElementById("importPreview"),
        /** @type {HTMLParagraphElement} Show warnings, errors, or other notes here *///@ts-ignore element does exist in DOM
        warn: document.getElementById("importWarn"),
        /** @type {HTMLInputElement} Button to confirm import, close {@linkcode html.import.menu}, and start decoding *///@ts-ignore element does exist in DOM
        confirm: document.getElementById("importConfirm"),
        /** @type {HTMLInputElement} Button to abort import and close {@linkcode html.import.menu} *///@ts-ignore element does exist in DOM
        abort: document.getElementById("importAbort")
    }),
    /** Confirm menu */
    confirm: Object.freeze({
        /** @type {HTMLDialogElement} The confirm menu element (use this to open or close dialog box) *///@ts-ignore element does exist in DOM
        menu: document.getElementById("confirmMenu"),
        /** @type {HTMLSpanElement} The text to confirm in the {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        text: document.getElementById("confirmText"),
        /** @type {HTMLInputElement} Button to confirm action and close {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        confirm: document.getElementById("confirmConfirm"),
        /** @type {HTMLInputElement} Button to abort action and close {@linkcode confirmMenu} *///@ts-ignore element does exist in DOM
        abort: document.getElementById("confirmAbort")
    })
});

//? if(html.view.canvas==null)throw new Error();
//? if(html.frame.canvas==null)throw new Error();

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

// TODO see notes in index.html
(()=>{
    "use strict";
    const args=new URLSearchParams(window.location.search);
    let _tmpVal_=null;
    ((_tmpVal_=args.get("gifURL"))==null?undefined:(_tmpVal_.length>0?decodeURIComponent(_tmpVal_):undefined))??"https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif";
})();

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

//~  _   _ _                                 _             _
//~ | | | (_)                               | |           | |
//~ | | | |_  _____      __   ___ ___  _ __ | |_ _ __ ___ | |___
//~ | | | | |/ _ \ \ /\ / /  / __/ _ \| '_ \| __| '__/ _ \| / __|
//~ \ \_/ / |  __/\ V  V /  | (_| (_) | | | | |_| | | (_) | \__ \
//~  \___/|_|\___| \_/\_/    \___\___/|_| |_|\__|_|  \___/|_|___/

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
        html.frame.viewContainerSummary.insertAdjacentElement("afterend",html.frame.view);
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

(()=>{//~ canvas (syncronised) pan and zoom controls
    let dragging=false,
        mouseX=0,
        mouseY=0,
        scaler=1;
    const canvasStyle=window.getComputedStyle(html.view.htmlCanvas),
        /** @type {(left?:number,top?:number)=>void} set canvas offset position (pixel) - default: recalculate position */
        setPosition=(left,top)=>{
            "use strict";
            if(left==null)left=Number.parseInt(html.root.style.getPropertyValue("--offset-view-left"));
            if(top==null)top=Number.parseInt(html.root.style.getPropertyValue("--offset-view-top"));
            const width=Number.parseFloat(canvasStyle.width),
                height=Number.parseFloat(canvasStyle.height);
            html.root.style.setProperty("--offset-view-left",`${Math.trunc(Math.max(width*-.5,Math.min(width*.5,left)))}px`);
            html.root.style.setProperty("--offset-view-top",`${Math.trunc(Math.max(height*-.5,Math.min(height*.5,top)))}px`);
        };
    html.root.style.setProperty("--offset-view-left","0px");
    html.root.style.setProperty("--offset-view-top","0px");
    //~ reset dragging
    html.view.view.addEventListener("dblclick",ev=>{
        "use strict";
        if((html.view.fitWindow.dataset.toggle??"0")==="0")return;
        setPosition(0,0);
        ev.preventDefault();
    });
    html.frame.view.addEventListener("dblclick",ev=>{
        "use strict";
        if((html.frame.fitWindow.dataset.toggle??"0")==="0")return;
        setPosition(0,0);
        ev.preventDefault();
    });
    //~ reset zoom
    html.view.view.addEventListener("mousedown",ev=>{
        "use strict";
        if(ev.button!==1||(html.view.fitWindow.dataset.toggle??"0")==="0")return;
        scaler=1;
        html.root.style.setProperty("--canvas-scaler","1");
        setPosition();
        ev.preventDefault();
    },{passive:false});
    html.frame.view.addEventListener("mousedown",ev=>{
        "use strict";
        if(ev.button!==1||(html.frame.fitWindow.dataset.toggle??"0")==="0")return;
        scaler=1;
        html.root.style.setProperty("--canvas-scaler","1");
        setPosition();
        ev.preventDefault();
    },{passive:false});
    //~ zoom
    document.addEventListener("wheel",ev=>{
        "use strict";
        if(ev.ctrlKey||!(
            ((html.view.view===ev.target||html.view.htmlCanvas===ev.target)&&(html.view.fitWindow.dataset.toggle??"0")==="1")
            ||((html.frame.view===ev.target||html.frame.htmlCanvas===ev.target)&&(html.frame.fitWindow.dataset.toggle??"0")==="1")
        ))return;
        const previousWidth=Number.parseFloat(canvasStyle.width),
            previousHeight=Number.parseFloat(canvasStyle.height);
        html.root.style.setProperty("--canvas-scaler",String(
            Math.exp((
                scaler=Math.max(html.view.htmlCanvas.width*-.5,
                    Math.min(html.view.htmlCanvas.width*.5,
                        ev.deltaY*-(ev.shiftKey?.5:ev.altKey?.01:.1)
                        +scaler
                    )
                )
            )*.01)
        ));
        setPosition(
            (Number.parseFloat(canvasStyle.width)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-left")))/previousWidth,
            (Number.parseFloat(canvasStyle.height)*Number.parseInt(html.root.style.getPropertyValue("--offset-view-top")))/previousHeight
        );
        ev.preventDefault();
    },{passive:false});
    //~ dragging
    document.addEventListener("mousedown",ev=>{
        "use strict";
        if(ev.button!==0||!(
            ((html.view.view===ev.target||html.view.htmlCanvas===ev.target)&&(html.view.fitWindow.dataset.toggle??"0")==="1")
            ||((html.frame.view===ev.target||html.frame.htmlCanvas===ev.target)&&(html.frame.fitWindow.dataset.toggle??"0")==="1")
        ))return;
        mouseX=ev.clientX;
        mouseY=ev.clientY;
        dragging=true;
        document.documentElement.classList.add("grabbing");
        ev.preventDefault();
    },{passive:false});
    document.addEventListener("mousemove",ev=>{
        "use strict";
        if(!dragging)return;
        setPosition(
            Number.parseInt(html.root.style.getPropertyValue("--offset-view-left"))+(ev.clientX-mouseX),
            Number.parseInt(html.root.style.getPropertyValue("--offset-view-top"))+(ev.clientY-mouseY)
        );
        mouseX=ev.clientX;
        mouseY=ev.clientY;
    },{passive:true});
    document.addEventListener("mouseup",()=>{
        "use strict";
        dragging=false;
        document.documentElement.classList.remove("grabbing");
    },{passive:true});
})();

//~  _   _ _   _ _ _ _            __                  _   _
//~ | | | | | (_) (_) |          / _|                | | (_)
//~ | | | | |_ _| |_| |_ _   _  | |_ _   _ _ __   ___| |_ _  ___  _ __  ___
//~ | | | | __| | | | __| | | | |  _| | | | '_ \ / __| __| |/ _ \| '_ \/ __|
//~ | |_| | |_| | | | |_| |_| | | | | |_| | | | | (__| |_| | (_) | | | \__ \
//~  \___/ \__|_|_|_|\__|\__, | |_|  \__,_|_| |_|\___|\__|_|\___/|_| |_|___/
//~                       __/ |
//~                      |___/

// TODO utility functions

const loadGifURL=url=>{};
const loadGifFile=file=>{};

/**
 * ## Copies own `value` to the clipboard and prevents default behaviour
 * (_use this for click events on color input fields to copy its hex code without showing the color input dialogue_)
 * @this {HTMLInputElement} `<input type="color">`
 * @param {MouseEvent} ev - `click` event
 */
const copyColorValue=function(ev){
    "use strict";
    ev.preventDefault();
    navigator.clipboard.writeText(this.value).then(
        null,
        reason=>console.warn("Couldn't copy color %s, reason: %O",this.value,reason)
    );
}

const genHTMLColorGrid=(colorTable)=>{};
const genHTMLCommentList=(gif)=>{};
const genHTMLAppExtList=(gif)=>{};

const updateGifInfo=gif=>{};
const updateFrameInfo=(gif,i)=>{};
const updateSliderValues=(gif,i,t)=>{};

//~  _____                _
//~ |  ___|              | |
//~ | |____   _____ _ __ | |_ ___
//~ |  __\ \ / / _ \ '_ \| __/ __|
//~ | |___\ V /  __/ | | | |_\__ \
//~ \____/ \_/ \___|_| |_|\__|___/

html.frame.text.foreground.addEventListener("click",copyColorValue,{passive:false});
html.frame.text.background.addEventListener("click",copyColorValue,{passive:false});

html.controls.userInputLock.addEventListener("click",()=>{
    "use strict";
    if((html.controls.userInputLock.dataset.toggle??"0")==="0"){
        html.controls.userInputLock.dataset.toggle="1";
        html.controls.userInput.disabled=true;
    }else{
        html.controls.userInputLock.dataset.toggle="0";
        html.controls.userInput.disabled=false;
    }
},{passive:true});

//~  _____ ___________                      _
//~ |  __ \_   _|  ___|                    | |
//~ | |  \/ | | | |_     _ __ ___ _ __   __| | ___ _ __
//~ | | __  | | |  _|   | '__/ _ \ '_ \ / _` |/ _ \ '__|
//~ | |_\ \_| |_| |     | | |  __/ | | | (_| |  __/ |
//~  \____/\___/\_|     |_|  \___|_| |_|\__,_|\___|_|

(()=>{// TODO remove
    //! importMenu.showModal();
    for(const{htmlCanvas:cnv}of [html.view,html.frame]){
        cnv.width=920;
        cnv.height=720;
    };
    const fn=()=>{
        "use strict";
        for(const{htmlCanvas:cnv,canvas:cnx}of [html.view,html.frame]){
            cnx.fillStyle="red";
            cnx.fillRect(0,0,cnv.width,cnv.height);
            cnx.fillStyle="blue";
            cnx.fillRect(cnv.width*.5-25,cnv.height*.5-25,50,50);
            cnx.strokeStyle="black";
            cnx.beginPath();
            cnx.moveTo(0,0);
            cnx.lineTo(cnv.width,cnv.height);
            cnx.moveTo(0,cnv.height);
            cnx.lineTo(cnv.width,0);
            cnx.stroke();
            cnx.closePath();
        }
        requestAnimationFrame(fn);
    };
    fn();
})();

// TODO use animation frames and calculate timing for gif frames
// TODO edge-case: abort update-loop if previous and current animation frame timestamp is the same value
// TODO ~ log animation frame time ? calculate frame ~ loop or last frame
// TODO use async functions for rendering ~ immediatly call next animation frame while doing work async ~

// console.log(0);
// (async()=>{
//     console.log(1);
//     await Promise.resolve();
//     console.log(2);
// })();
// console.log(3);
//=> 0 1 3 <EOF> 2

throw 0;
// TODO ↓

/*
    const img=new ImageData(Uint8ClampedArray.of(1,0x7F,0xFF,0xFF),1,1,{colorSpace:"srgb"});
    // replace pixels on canvas with image (incl. alpha)
    ctx.putImageData(img,0,0);
    // add image pixels to canvas (add alpha)
    ctx.drawImage(await createImageBitmap(img),0,0);
*/

document.body.style.margin="0";
document.body.style.overflow="hidden";

const canvas=document.createElement("canvas");
document.body.appendChild(canvas);
canvas.width=window.innerWidth;
canvas.height=window.innerHeight;
canvas.style.backgroundColor="black";
window.addEventListener("resize",()=>{
    canvas.width=window.innerWidth;
    canvas.height=window.innerHeight;
},{passive:true});

const ctx=canvas.getContext("2d");
if(ctx==null)throw new Error("couldn't get 2d context of canvas");
ctx.imageSmoothingQuality="low";
ctx.imageSmoothingEnabled=false;

const progressBar=document.createElement("progress");
document.body.appendChild(progressBar);
progressBar.max=1;
progressBar.value=0;
progressBar.style.position="absolute";
progressBar.style.left="50%";
progressBar.style.top="50%";
progressBar.style.transform="translate(-50%,-50%)";

let frameMemoryUsage=0;

/**@type {(num:number)=>string} adds `'` for each 3 digits (from the right) in `num`*/
const _fNum_=num=>{
    "use strict";
    let n=num.toString();
    const offset=n.length%3;
    for(let i=offset===0?3:offset;i<n.length;i+=4)n=`${n.substring(0,i)}'${n.substring(i)}`;
    return n;
};

const forceClearLastFrame=true,
    alertErrors=true,
    gifURL="https://upload.wikimedia.org/wikipedia/commons/a/a2/Wax_fire.gif";

decodeGIF(gifURL,async(percentageRead,frameCount,frameUpdate,framePos,gifSize)=>{
    progressBar.value=percentageRead;
    ctx.drawImage(await createImageBitmap(frameUpdate),(canvas.width-gifSize[0])*.5+framePos[0],(canvas.height-gifSize[1])*.5+framePos[1]);
    frameMemoryUsage+=frameUpdate.data.length;
    const text=`frame ${_fNum_(frameCount)} (${_fNum_(frameMemoryUsage)} Bytes)`,
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
