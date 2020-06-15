export const id = () =>
	"_" +
	Math.random()
		.toString(36)
		.substr(2, 9);

export const random = (min, max) => Math.random() * (max - min) + min;

export const randomHexColorCode = () => {
  let n = (Math.random() * 0xfffff * 1000000).toString(16);
  return "#" + n.slice(0, 6);
}

export function log(e){
	/* console.log(...e); */
};

export function nil(e){};

export function isEmpty(str){
		return !str || 0 === str.length;
};

export function isRelativeURL(str) {
	if (isEmpty(str)) return false;
	else {
		let re = /^[^\/]+\/[^\/].*$|^\/[^\/].*$/;
		return re.exec(str)[0] === re.exec(str).input;
	}
};


export async function fetchFrom(url){
  
	if (!isEmpty(url)) {
    try{
      const res = await fetch(url);
      return await res.text();
    }
    catch(error){ 
      throw Error(error);
    }
  } else throw Error("Error fetchFrom: Empty URL");
};