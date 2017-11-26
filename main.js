const fs = require("fs");
const Jimp = require("jimp");

let filename = "chr_knight";
let cursor = 0;
let data = fs.readFileSync("./in/"+filename+".vox")
let palette = convertPalette(defaultPalette());
let out_base_dir = "out";
let out_dir = out_base_dir+"/"+filename;
try{
	if(fs.statSync(out_base_dir));
	else fs.mkdirSync(out_base_dir);
}catch(err) {
	console.log("Exception:" + err);
	fs.mkdirSync(out_base_dir);
}
try{
	if(fs.statSync(out_dir));
	else fs.mkdirSync(out_dir);
}catch(err) {
	console.log("Exception:" + err);
	fs.mkdirSync(out_dir);
}

console.log(getString(4));
console.log(getValue(4));
let ret_data = getChunk();
console.log(ret_data);
console.log(ret_data.child.models);
//console.log(ret_data.child.models[0].size.data);
//console.log(ret_data.child.models[0].xyzi.blocks);

const delta_angle = 10;
const angle_count = 360/delta_angle;

for(let model of ret_data.child.models) {
	let model_rate = 2;
	let model_x = model.size.data[0]*model_rate;
	let model_y = model.size.data[1]*model_rate;
	let model_z = model.size.data[2];
	let image = new Jimp(model_x*2*angle_count,model_y*2*model_z,function(err,image) {
		let kansei_image = new Jimp(model_x*2*angle_count,model_y*2+model_z,function(err,kansei_image) {
			let outputImage = function() {
				//image.scale(16,Jimp.RESIZE_NEAREST_NEIGHBOR);
				image.write(out_dir+"/result.png");
				kansei_image.write(out_dir+"/result2.png");
			}
			let oneLayer = function(_layer) {
				return new Promise(function(resolve) {
					let base_image = new Jimp(model_x/model_rate,model_y/model_rate,function(err,base_image) {
						//base_image.opaque();
						console.log("layer"+_layer)
						let flag = false;
						for(let arr of model.xyzi.blocks) {
							if(arr[2]==_layer) {
								base_image.setPixelColor(palette[arr[3]-1],arr[0],arr[1]);
								flag = true;
							}
						}
						base_image.scale(2,Jimp.RESIZE_NEAREST_NEIGHBOR);
						if(flag) {
							for(let i = 0; i < angle_count; i++) {
								let clone_image = base_image.clone();
								clone_image.rotate(delta_angle*i,false);
								image.blit(clone_image,model_x*2*i,model_y*2*_layer);
								kansei_image.composite(clone_image,model_x*2*i,model_y*2-model_z-_layer);
							}
						}
						resolve(1);
					});
				});
			}
			let promise_array = [];
			for(let layer = 0; layer < model_z; layer++) {
				promise_array.push(oneLayer(layer));
			}
			Promise.all(promise_array)
			.then((_result)=>{
				console.log(_result);
				outputImage();
			});
		});
	});
}

function getChunk() {
	let name = getString(4);
	let chunk = {};
	if(name=="MAIN") chunk = chunkMain();
	if(name=="PACK") chunk = chunkPack();
	if(name=="SIZE") chunk = chunkSize();
	if(name=="XYZI") chunk = chunkXyzi();
	if(name=="RGBA") chunk = chunkRgba();
	if(name=="MATT") chunk = chunkMatt();
	chunk.name = name;
	return chunk;
}

function basicChunkInfo() {
	return {
		n: getValue(4),
		m: getValue(4)
	};
}

function chunkMain() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = getSubData(chunk_data.n);
	chunk_data.child = getChunk();
	return chunk_data;
}

function chunkPack() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = getValue(chunk_data.n);
	chunk_data.child = {};
	chunk_data.models = [];
	for(let i = 0; i < chunk_data.data; i++) {
		chunk_data.models.push({
			size: getChunk(),
			xyzi: getChunk()
		});
	}
	return chunk_data;
}

function chunkSize() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = [getValue(4),getValue(4),getValue(4)];
	chunk_data.child = {};
	chunk_data.x = chunk_data.data[0];
	chunk_data.y = chunk_data.data[1];
	chunk_data.z = chunk_data.data[2];
	return chunk_data;
}

function chunkXyzi() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = [];
	chunk_data.child = {};
	chunk_data.numVoxels = getValue(4);
	chunk_data.blocks = [];
	for(let i = 0; i < chunk_data.numVoxels; i++) {
		chunk_data.blocks.push(
			[getValue(1),getValue(1),getValue(1),getValue(1)]
		);
	}
	return chunk_data;
}

function chunkRgba() {

}

function chunkMatt() {

}

function defaultPalette() {
	return [
		0x00000000, 0xffffffff, 0xffccffff, 0xff99ffff, 0xff66ffff, 0xff33ffff, 0xff00ffff, 0xffffccff, 0xffccccff, 0xff99ccff, 0xff66ccff, 0xff33ccff, 0xff00ccff, 0xffff99ff, 0xffcc99ff, 0xff9999ff,
		0xff6699ff, 0xff3399ff, 0xff0099ff, 0xffff66ff, 0xffcc66ff, 0xff9966ff, 0xff6666ff, 0xff3366ff, 0xff0066ff, 0xffff33ff, 0xffcc33ff, 0xff9933ff, 0xff6633ff, 0xff3333ff, 0xff0033ff, 0xffff00ff,
		0xffcc00ff, 0xff9900ff, 0xff6600ff, 0xff3300ff, 0xff0000ff, 0xffffffcc, 0xffccffcc, 0xff99ffcc, 0xff66ffcc, 0xff33ffcc, 0xff00ffcc, 0xffffcccc, 0xffcccccc, 0xff99cccc, 0xff66cccc, 0xff33cccc,
		0xff00cccc, 0xffff99cc, 0xffcc99cc, 0xff9999cc, 0xff6699cc, 0xff3399cc, 0xff0099cc, 0xffff66cc, 0xffcc66cc, 0xff9966cc, 0xff6666cc, 0xff3366cc, 0xff0066cc, 0xffff33cc, 0xffcc33cc, 0xff9933cc,
		0xff6633cc, 0xff3333cc, 0xff0033cc, 0xffff00cc, 0xffcc00cc, 0xff9900cc, 0xff6600cc, 0xff3300cc, 0xff0000cc, 0xffffff99, 0xffccff99, 0xff99ff99, 0xff66ff99, 0xff33ff99, 0xff00ff99, 0xffffcc99,
		0xffcccc99, 0xff99cc99, 0xff66cc99, 0xff33cc99, 0xff00cc99, 0xffff9999, 0xffcc9999, 0xff999999, 0xff669999, 0xff339999, 0xff009999, 0xffff6699, 0xffcc6699, 0xff996699, 0xff666699, 0xff336699,
		0xff006699, 0xffff3399, 0xffcc3399, 0xff993399, 0xff663399, 0xff333399, 0xff003399, 0xffff0099, 0xffcc0099, 0xff990099, 0xff660099, 0xff330099, 0xff000099, 0xffffff66, 0xffccff66, 0xff99ff66,
		0xff66ff66, 0xff33ff66, 0xff00ff66, 0xffffcc66, 0xffcccc66, 0xff99cc66, 0xff66cc66, 0xff33cc66, 0xff00cc66, 0xffff9966, 0xffcc9966, 0xff999966, 0xff669966, 0xff339966, 0xff009966, 0xffff6666,
		0xffcc6666, 0xff996666, 0xff666666, 0xff336666, 0xff006666, 0xffff3366, 0xffcc3366, 0xff993366, 0xff663366, 0xff333366, 0xff003366, 0xffff0066, 0xffcc0066, 0xff990066, 0xff660066, 0xff330066,
		0xff000066, 0xffffff33, 0xffccff33, 0xff99ff33, 0xff66ff33, 0xff33ff33, 0xff00ff33, 0xffffcc33, 0xffcccc33, 0xff99cc33, 0xff66cc33, 0xff33cc33, 0xff00cc33, 0xffff9933, 0xffcc9933, 0xff999933,
		0xff669933, 0xff339933, 0xff009933, 0xffff6633, 0xffcc6633, 0xff996633, 0xff666633, 0xff336633, 0xff006633, 0xffff3333, 0xffcc3333, 0xff993333, 0xff663333, 0xff333333, 0xff003333, 0xffff0033,
		0xffcc0033, 0xff990033, 0xff660033, 0xff330033, 0xff000033, 0xffffff00, 0xffccff00, 0xff99ff00, 0xff66ff00, 0xff33ff00, 0xff00ff00, 0xffffcc00, 0xffcccc00, 0xff99cc00, 0xff66cc00, 0xff33cc00,
		0xff00cc00, 0xffff9900, 0xffcc9900, 0xff999900, 0xff669900, 0xff339900, 0xff009900, 0xffff6600, 0xffcc6600, 0xff996600, 0xff666600, 0xff336600, 0xff006600, 0xffff3300, 0xffcc3300, 0xff993300,
		0xff663300, 0xff333300, 0xff003300, 0xffff0000, 0xffcc0000, 0xff990000, 0xff660000, 0xff330000, 0xff0000ee, 0xff0000dd, 0xff0000bb, 0xff0000aa, 0xff000088, 0xff000077, 0xff000055, 0xff000044,
		0xff000022, 0xff000011, 0xff00ee00, 0xff00dd00, 0xff00bb00, 0xff00aa00, 0xff008800, 0xff007700, 0xff005500, 0xff004400, 0xff002200, 0xff001100, 0xffee0000, 0xffdd0000, 0xffbb0000, 0xffaa0000,
		0xff880000, 0xff770000, 0xff550000, 0xff440000, 0xff220000, 0xff110000, 0xffeeeeee, 0xffdddddd, 0xffbbbbbb, 0xffaaaaaa, 0xff888888, 0xff777777, 0xff555555, 0xff444444, 0xff222222, 0xff111111
	];
}

function convertPalette(temp_palette) {
	let return_palette = [];
	for(let i = 0; i < temp_palette.length; i++) {
		return_palette.push(0x000000ff+((temp_palette[i]&0x0000ff)<<24)+((temp_palette[i]&0x00ff00)<<8)+((temp_palette[i]&0xff0000)>>8));
	}
	return return_palette;
}

function hasNext() {
	return cursor<data.length;
}

function next() {
	cursor++;
}

function getSubData(_len) {
	return data.slice(cursor,Math.min(data.length,cursor+_len));
}

function getString(_len) {
	let _ret = "";
	for(let i = cursor, j = 0; hasNext()&&j<_len; next(),i++,j++) {
		_ret += String.fromCharCode(data[i]);
	}
	return _ret;
}

function getValue(_len) {
	let _ret = 0;
	for(let i = cursor, j = 0; hasNext()&&j<_len; next(),i++,j++) {
		_ret += data[i] << 8*j;
	}
	return _ret;
}
