export default class DocumentProxy<Tdoc extends object> implements ProxyHandler<Tdoc> {
	
	readonly SRC_DOC:Tdoc;
	readonly PROXY:Tdoc;
	private readonly _DELETED_KEYS = new Set<PropertyKey>();
	private readonly _GET_VALUE_FROM_SRC = new Set<PropertyKey>();
	private _prototypeSet = false;

	constructor(doc:Tdoc){

		this.SRC_DOC = doc;

		let proxyDoc:any = doc instanceof Array ? [] : {};

		Reflect.setPrototypeOf(proxyDoc, Reflect.getPrototypeOf(doc));

		this.PROXY = new Proxy(proxyDoc, this);

	};

	defineProperty(target:Tdoc, prop:PropertyKey, descriptor:PropertyDescriptor){

		this._temporalizeProperty(target, prop);

		let result = Reflect.defineProperty(target, prop, descriptor);

		if(result){
			
			this._DELETED_KEYS.delete(prop);

		};

		return result;

	};

	deleteProperty(target:Tdoc, prop:PropertyKey){

		this._temporalizeProperty(target, prop);

		let result = Reflect.deleteProperty(target, prop);
		
		if(result){

			this._DELETED_KEYS.add(prop);
			// this._GET_VALUE_FROM_SRC.delete(prop); Occurs at the "_temporalizeProperty" call

		};

		return result;

	};

	get(target:Tdoc, prop:PropertyKey, receiver){

		if(prop === DocumentProxy.DOCUMENT_PROXY_KEY){
		
			return this;
		
		};

		this._temporalizeProperty(target, prop);

		return Reflect.get(target, prop, receiver);
	
	};

	getOwnPropertyDescriptor(target:Tdoc, prop:PropertyKey){

		this._temporalizeProperty(target, prop);

		return Reflect.getOwnPropertyDescriptor(target, prop);

	};

	getPrototypeOf(target:Tdoc){

		if(!this._prototypeSet){

			this.setPrototypeOf(target,Reflect.getPrototypeOf(this.SRC_DOC));
		
		};

		return Reflect.getPrototypeOf(target);

	};

	has(target:Tdoc, prop:PropertyKey){

		if(Reflect.isExtensible(target)){

			return Reflect.has(target,prop) || !this._DELETED_KEYS.has(prop) && Reflect.has(this.SRC_DOC, prop);

		};

		return Reflect.has(target,prop);

	};

	isExtensible(target:Tdoc){

		if(Reflect.isExtensible(target) && !Reflect.isExtensible(this.SRC_DOC)){

			this.preventExtensions(target);

		};

		return Reflect.isExtensible(target);

	};

	ownKeys(target:Tdoc){

		let targetKeys = Reflect.ownKeys(target);

		if(!Reflect.isExtensible(target)){

			return targetKeys;

		};

		let deletedKeys = this._DELETED_KEYS;

		let keys = new Set<PropertyKey>();

		//Add src doc keys
		for(let key of Reflect.ownKeys(this.SRC_DOC)){

			if(!deletedKeys.has(key)){

				keys.add(key);
			
			};

		};

		//Add target keys
		for(let key of targetKeys){

			keys.add(key);

		};

		return Array.from(keys);

	};

	preventExtensions(target:Tdoc){

		if(Reflect.isExtensible(target)){

			let srcDoc = this.SRC_DOC;
			let isEnumerable = <(prop:PropertyKey)=>boolean>Object.prototype.propertyIsEnumerable.bind(srcDoc);
			let getValueFromSrc = this._GET_VALUE_FROM_SRC;
			let deletedKeys = this._DELETED_KEYS;

			for(let key of Reflect.ownKeys(srcDoc)){

				if(!Reflect.has(target, key) && !deletedKeys.has(key) && Reflect.defineProperty(target, key,{

						value:undefined,
						writable:true,
						configurable:true,

						//Enumerablity is a key property, it is temporalize with the key.
						enumerable:isEnumerable(key),

				})){

					getValueFromSrc.add(key);

				};

			};

			if(this._isArray(target)){

				this._setLength(target);

			};

			//Temporalize prototype
				//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/preventExtensions
					//This method makes the [[prototype]] of the target immutable; any [[prototype]] re-assignment will throw a TypeError.
			if(!this._prototypeSet){

				this.setPrototypeOf(target, Reflect.getPrototypeOf(this.SRC_DOC));

			};

		};

		return Reflect.preventExtensions(target);

	};

	set(target:Tdoc, prop:PropertyKey, value, receiver){

		this._temporalizeProperty(target, prop);

		let result = Reflect.set(target, prop, value, receiver);

		if(result){

			this._DELETED_KEYS.delete(prop);
		
		};

		return result;

	};

	setPrototypeOf(target:Tdoc, prototype:object){

		let result = Reflect.setPrototypeOf(target, prototype);

		if(result){

			this._prototypeSet = true;

		};

		return result;

	};

	private _isArray(target:Tdoc):boolean{

		return (this._prototypeSet ? target : this.SRC_DOC) instanceof Array;

	};

	private _setLength(target:Tdoc):boolean{

		let srcDoc = this.SRC_DOC;

		let targetLength = <number>Reflect.get(target,'length');
		let srcLength = <number>Reflect.get(srcDoc,'length');

		if(srcLength > targetLength){

			return Reflect.set(target, 'length', srcLength);

		} else if(targetLength > srcLength){

			let getValueFromSrc = this._GET_VALUE_FROM_SRC;

			//Remove empty elements from the end of the target Array to the length of the src Array.
			let stopIndex = srcLength - 1;

			for(let i = targetLength - 1; i > stopIndex; i--){

				let key = i.toString();

				if(!getValueFromSrc.has(key) && Reflect.has(target, key)){

					return Reflect.set(target, 'length', i + 1);

				};

				Reflect.deleteProperty(target, key);

			};

			return Reflect.set(target, 'length', srcLength);
		
		};

		return true;

	};

	private _parseValue(value:any){

		if(typeof value === 'object'){

			value = (new DocumentProxy(value)).PROXY;

		};

		return value;
	
	};

	private _parseDescriptor(propertyDescriptor:PropertyDescriptor):PropertyDescriptor{

		if(Reflect.has(propertyDescriptor,'value')){

			propertyDescriptor.value = this._parseValue(propertyDescriptor.value);

		} else if(Reflect.has(propertyDescriptor,'get') && typeof propertyDescriptor.get === 'function'){

			let get = propertyDescriptor.get;
			let parseValue = this._parseValue;

			propertyDescriptor.get = function(){

				return parseValue(get.call(this));

			};

		};

		return propertyDescriptor;

	};

	private _temporalizeProperty(target:Tdoc, prop:PropertyKey):boolean {

		if(prop === 'length' && this._isArray(target)){

			return Reflect.isExtensible(target) ? this._setLength(target) : true;

		} else if(this._GET_VALUE_FROM_SRC.has(prop)){

			let propertyDescriptor = Reflect.getOwnPropertyDescriptor(this.SRC_DOC, prop);

			let result = true;

			if(propertyDescriptor !== undefined){

				//Enumerablity is a key property that is temporlized when prop is added to '_GET_VALUE_FROM_SRC'
				propertyDescriptor.enumerable = Reflect.getOwnPropertyDescriptor(target,prop).enumerable;

				result = Reflect.defineProperty(target, prop, this._parseDescriptor(propertyDescriptor));

			};

			if(result){
				
				this._GET_VALUE_FROM_SRC.delete(prop);

			};

			return result;
		
		} else if(!Reflect.has(target, prop) && Reflect.has(this.SRC_DOC, prop) && !this._DELETED_KEYS.has(prop)){

			let propertyDescriptor = Reflect.getOwnPropertyDescriptor(this.SRC_DOC, prop);

			//Prototype
			if(propertyDescriptor === undefined){

				return true;

			};

			return Reflect.defineProperty(target, prop, this._parseDescriptor(propertyDescriptor));

		};


		return true;

	};

  	static readonly DOCUMENT_PROXY_KEY = Symbol();

};