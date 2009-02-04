/*

Some of this code is part of the Flash / JavaScript Integration Kit:
http://www.macromedia.com/go/flashjavascript/

Created by:

Christian Cantrell
http://weblogs.macromedia.com/cantrell/
mailto:cantrell@macromedia.com

Mike Chambers
http://weblogs.macromedia.com/mesh/
mailto:mesh@macromedia.com

Macromedia

***** Added 1/17/06 by Geoff Stearns (geoff@deconcept.com):

This version of the JS Integration kit requires swfobject 1.4 or later
Download SWFObject at http://blog.deconcept.com/swfobject/

the swfobject.js file must be linked before this file is linked.

SWFObject is (c) 2006 Geoff Stearns and is released under the MIT License:
http://www.opensource.org/licenses/mit-license.php

*/

/**
 * The FlashSerializer serializes JavaScript variables of types object, array, string,
 * number, date, boolean, null or undefined into XML. 
 */

/**
 * Create a new instance of the FlashSerializer.
 * useCdata: Whether strings should be treated as character data. If false, strings are simply XML encoded.
 */
function FlashSerializer(useCdata){
  this.useCdata = useCdata;
}

/**
 * use encodeURIComponent() if the browser supports it, otherwise use escape()
 */
FlashSerializer.prototype.encodeVal = function(val){
  if(document.encodeURIComponent) {
    return encodeURIComponent(val);
  }
  return escape(val);
}

/**
 * Serialize an array into a format that can be deserialized in Flash. Supported data types are object,
 * array, string, number, date, boolean, null, and undefined. Returns a string of serialized data.
 */
FlashSerializer.prototype.serialize = function(val){
  var result = new Array();
  switch(typeof val){
    case 'undefined':
      result[0] = 'undef';
      break;
    case 'string':
      result[0] = 'str';
      result[1] = this.encodeVal(val);
      break;
    case 'number':
      result[0] = 'num';
      result[1] = val.toString();
      break;
    case 'boolean':
      result[0] = 'bool';
      result[1] = val.toString();
      break;
    case 'object':
      if (val == null) {
        result[0] = 'null';
      } else if (val.getTime) {
        result[0] = 'date';
        result[1] = this.encodeVal(val.getTime());
      } else { // array or object
        try {
          result[0] = 'xser';
          result[1] = this.encodeVal(this._serializeXML(val));
        }catch (e){}
      }
      break;
    default:
      // do nothing
  }
  return result;
}

/**
 * Private
 */
FlashSerializer.prototype._serializeXML = function(obj)
{
    var doc = new Object();
    doc.xml = '<fp>'; 
    this._serializeNode(obj, doc, null);
    doc.xml += '</fp>'; 
    return doc.xml;
}

/**
 * Private
 */
FlashSerializer.prototype._serializeNode = function(obj, doc, name){
  switch(typeof obj) {
    case 'undefined':
      doc.xml += '<undf'+this._addName(name)+'/>';
      break;
    case 'string':
      doc.xml += '<str'+this._addName(name)+'>'+this._escapeXml(obj)+'</str>';
      break;
    case 'number':
      doc.xml += '<num'+this._addName(name)+'>'+obj+'</num>';
      break;
    case 'boolean':
      doc.xml += '<bool'+this._addName(name)+' val="'+obj+'"/>';
      break;
    case 'object':
      if (obj == null) {
        doc.xml += '<null'+this._addName(name)+'/>';
      } else if (obj.getTime) {
        doc.xml += '<date'+this._addName(name)+'>'+obj.getTime()+'</date>';
      } else if (obj.length != undefined) {
        doc.xml += '<array'+this._addName(name)+'>';
        for (var i = 0; i < obj.length; ++i) {
          this._serializeNode(obj[i], doc, null);
        }
        doc.xml += '</array>';
      } else {
        doc.xml += '<obj'+this._addName(name)+'>';
        for (var n in obj) {
          if (typeof(obj[n]) == 'function') {
            continue;
          }
        this._serializeNode(obj[n], doc, n);
        }
        doc.xml += '</obj>';
      }
      break;
    default:
      // do nothing
  }
}

/**
 * Private
 */
FlashSerializer.prototype._addName= function(name){
  if (name != null) {
    return ' name="'+name+'"';
  }
  return '';
}

/**
 * Private
 */
FlashSerializer.prototype._escapeXml = function(str){
  if (this.useCdata) {
    return '<![CDATA['+str+']]>';
  } else {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  }
}

/**
 * setProxy creates the unique uid the flash movie will need to get calls from javascript
 *
 */
deconcept.SWFObject.prototype.setProxy = function(callbackScope, swfUrl){
  this.uid = new Date().getTime();
  deconcept.SWFObject.fpmap[this.uid] = this;
  this.q = new Array();
  this.callbackScope = callbackScope;
  this.proxySwfName = swfUrl ? swfUrl : "swfobject_js_gateway.swf";
  this.flashSerializer = new FlashSerializer(false);
  this.addVariable('lcId', this.uid);
  var isIE = (document.all && !window.opera) ? true : false;
  this.addVariable('jsintkit_isIE', isIE);

  if (isIE) {
    // add fscommand catcher
    var scriptNode = document.createElement("script");
    scriptNode.setAttribute("type", "text/vbscript");
    // can't use appendChild on script nodes, so using .text instead
    scriptNode.text = 'Sub '+ this.getAttribute('id') +'_FSCommand(ByVal command, ByVal args) call deconcept.SWFObject.callJS(command, args) End Sub';
    document.getElementsByTagName('head')[0].appendChild(scriptNode);
  }
}

/**
 * Call a function in your Flash content.  Arguments should be:
 * 1. ActionScript function name to call,
 * 2. any number of additional arguments of type object,
 *    array, string, number, boolean, date, null, or undefined. 
 */
deconcept.SWFObject.prototype.call = function() {
  if (!this.uid || arguments.length == 0) {
    return;
  }

  this.q.push(arguments);
  if (this.q.length == 1){
    this._execute(arguments);
  }
}

/**
 * "Private" function.  Don't call.
 */
deconcept.SWFObject.prototype._execute = function(args){
  var fo = new SWFObject(this.proxySwfName, "flashproxy", 1, 1, 6);
  fo.addVariable('lcId', this.uid);
  fo.addVariable('functionName', args[0]);

  if (args.length > 1) {
    for (var i=1; i<args.length; ++i) {
      var serialized = this.flashSerializer.serialize(args[i]);
      fo.addVariable('t'+(i-1), serialized[0]);
      if (serialized.length > 1) {
        fo.addVariable('d'+(i-1), serialized[1]);
      }
    }
  }

  var divName = '_flash_proxy_' + this.uid;
  if(!document.getElementById(divName)) {
    var newTarget = document.createElement("div");
    newTarget.id = divName;
    document.body.appendChild(newTarget);
  }
  fo.write(divName);
}

/**
 * This is the function that proxies function calls from Flash to JavaScript.
 * It is called implicitly.
 */
deconcept.SWFObject.callJS = function(command, args){
  var argsArray = eval(args);

	var scope = deconcept.SWFObject.fpmap[argsArray.shift()].callbackScope;

	if(scope && (command.indexOf('.') < 0)){
    var functionToCall = scope[command];
    functionToCall.apply(scope, argsArray);
  }else{
    var functionToCall = eval(command);
    functionToCall.apply(functionToCall, argsArray);
  }
}

 /**
  * This function gets called when a Flash function call is complete. It checks the
  * queue and figures out whether there is another call to make.
  */
deconcept.SWFObject.callComplete = function(uid){
  var fp = deconcept.SWFObject.fpmap[uid];
  if (fp != null) {
    fp.q.shift();
    if (fp.q.length > 0) {
      fp._execute(fp.q[0]);
    }
  }
}

deconcept.SWFObject.fpmap = new Object();
