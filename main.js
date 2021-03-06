const fs = require("fs");
const Jimp = require("jimp");

//出力画像サイズ
const IMG_WIDTH = 256;
const IMG_HEIGHT = 256;

//最小回転単位
const delta_angle = 10;
const angle_count = 360/delta_angle;

const push_rate = 0.5;	//縦方向の圧縮率(カメラの高さに当たる)
const model_rate = 2;	//拡大率(細すぎる線が回転時に消えてしまうため一時的に拡大する)

//読み込むファイル(実行場所を基点とした、「ディレクトリの辿り部分」と「.vox」を除いたファイル名)
const filenames = ["nummodel","kusa","cookie","chr_knight_slim","3x3x3","kusa","piron","pine"];
let out_base_dir = "allout";
//出力先フォルダなければ作成
try{
	if(fs.statSync(out_base_dir));
	else fs.mkdirSync(out_base_dir);
}catch(err) {
	console.log("Exception:" + err);
	fs.mkdirSync(out_base_dir);
}

//ファイル読み込み用
let cursor = 0;
let data = "";
let palette = [];

let kansei_images = [];	//各角度ごとの完成形画像
let promise_arr = [];

Promise.resolve()
.then(() => {
	let file_arr = [];
	for(let i = 0; i < angle_count; i++) {
		file_arr.push(i);
	}
	return file_arr.reduce((prev,next) => {
		return prev
		.then(() => {
			return new Promise(resolve => {
				fs.mkdir(`${out_base_dir}/${next}`,() => {
					resolve();
				});
			})
		})
	},Promise.resolve());
})
.then(() => {
	//ファイル単位の処理
	return filenames.reduce((promise,filename) => promise.then(() => {
		//各種データ読み込み
		console.log("filename",filename);
		cursor = 0;
		data = fs.readFileSync("./in/"+filename+".vox");
		palette =  convertPalette(defaultPalette());
		let ret_data = getVoxData();
		console.log(ret_data);

		//各モデルごとの処理
		return ret_data.children.XYZI.reduce((promise2,XYZI,model_count) => promise2.then(() => {
			console.log(filename,"model",model_count);
			//モデルの3軸長さ
			let SIZE = ret_data.children.SIZE[model_count].data;
			let model_x = SIZE[0];
			let model_y = SIZE[1];
			let model_z = SIZE[2];
			console.log(SIZE);

			//断面の画像サイズ
			//一回転するから、どっちか大きいほう
			//断面の回転時全包矩形は元の矩形の縦横2倍に収まるという前提の*2
			//縦横長さ違う画像でも何故か回転後ハミ出しがない。
			let danmen_w = model_x*2;
			let danmen_h = model_y*2;

			//スプライトシート上での画像サイズ
			//断面を高さ分重ねるので_hはモデルのz大きさ分プラス
			let _w = Math.max(danmen_w,danmen_h)*2;
			let _h = (_w*push_rate+model_z*model_rate);

			//断面のピクセル情報書き込み用の一時画像を用意
			let temp_image;
			return new Promise((resolve,reject) => {
				new Jimp(danmen_w,danmen_h,function(err,img) {
					if(err) reject(err);
					resolve(img);
				});
			})
			.then(_img => {
				temp_image = _img;
			}).then(() => {
				//ピクセル情報整理
				//各高さごとのピクセル配列にアクセスできる形の連想配列
				let layer_blocks = {};
				for(let arr of XYZI.blocks) {
					if(!layer_blocks[arr[2]]) layer_blocks[arr[2]] = [];
					layer_blocks[arr[2]].push(arr);
				}
				//各断面ごとの画像反映処理
				let oneLayer = function(_layer) {
					console.log("layer"+_layer);
					return new Promise((resolve) => {
						//透明なbase_imageに、その断面内のピクセル位置の色を塗る
						let base_image = temp_image.clone();
						if(layer_blocks[_layer]) {
							for(let arr of layer_blocks[_layer]) {
								//arr = {palette_index, x, y, z}
								base_image.setPixelColor(palette[arr[3]],arr[0]+model_x/2,arr[1]+model_y/2);
							}
						}
						base_image.scale(model_rate,Jimp.RESIZE_NEAREST_NEIGHBOR);
						if(layer_blocks[_layer]) {
							for(let i = 0; i < angle_count; i++) {
								let clone_image = base_image.clone();
								clone_image.rotate(delta_angle*i,false);
								clone_image.resize(clone_image.bitmap.width,clone_image.bitmap.height*push_rate,Jimp.RESIZE_NEAREST_NEIGHBOR);
								//image.composite(clone_image,model_x*i*model_rate,model_y*_layer*push_rate*model_rate);
								for(let j = -1; j < model_rate; j++) {
									//kansei_images[i].composite(clone_image,model_x*model_rate+sheet_x,(model_z-_layer)*model_rate-j+sheet_y);
									kansei_images[i].composite(clone_image,0,(model_z-_layer)*model_rate-j);
								}
							}
						}
						resolve();
					});
				}

				layers = [];
				kansei_images = [];
				for(let layer = 0; layer < model_z; layer++) {
					layers.push(layer);
				}
				console.log(layers);

				let angles = [];
				for(let angle_temp = 0; angle_temp < angle_count; angle_temp++) {
					angles.push(angle_temp);
				}

				return angles.reduce((prev,next) => {
					return prev.then(() => {
						return new Promise((resolve,reject) => {
							console.log(next);
							new Jimp(_w,_h,function(err,img) {
								if(err) reject(err);
								kansei_images[next] = img;
								resolve();
							});
						})
					})
				},Promise.resolve())
				.then(() => layers.reduce((prev,next) => {
						return prev
						.then(() => oneLayer(next));
					},Promise.resolve())
				)
				.then(() => {
						for(let i = 0; i < angle_count; i++) {
							let clone_kansei_image = kansei_images[i].clone();
							for(let _d of [[1,0],[0,-1],[0,1],[-1,0]]) {
								kansei_images[i].composite(clone_kansei_image,_d[0],_d[1]);
							}
							kansei_images[i].brightness(-0.75);
							kansei_images[i].composite(clone_kansei_image,0,0);
							kansei_images[i].write(`${out_base_dir}/${i}/${filename}_${model_count}.png`);
						}
				})
				;
			})
			;
		}),Promise.resolve());
	}),Promise.resolve());
})
.then(()=>{
	console.log("ALL END")
})
;

function calcSheetOffset(w,h) {
	if(sheet_x+w >= IMG_WIDTH) {
		sheet_x = 0;
		sheet_y += h;
	}else {
		sheet_x += w;
	}
}

function getVoxData(_raw) {
	getString(4);
	getValue(4);
	return getChunk();
}

function getChunk() {
	if(!hasNext()) return null;
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
		m: getValue(4),
		children: {}
	};
}

function readChildChunks() {
	let children = {};
	while(hasNext()) {
		let chunk = getChunk();
		if(!children[chunk.name]) children[chunk.name] = [];
		children[chunk.name].push(chunk);
	}
	return children;
}

function chunkMain() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = getSubData(chunk_data.n);
	chunk_data.children = readChildChunks();
	return chunk_data;
}

function chunkPack() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = getValue(chunk_data.n);
	return chunk_data;
}

function chunkSize() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = [getValue(4),getValue(4),getValue(4)];
	chunk_data.x = chunk_data.data[0];
	chunk_data.y = chunk_data.data[1];
	chunk_data.z = chunk_data.data[2];
	return chunk_data;
}

function chunkXyzi() {
	let chunk_data = basicChunkInfo();
	chunk_data.data = [];
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
	let chunk_data = basicChunkInfo();
	chunk_data.data = [];
	let colors = [];
	for(let i = 0; i < 0xff; i++) {
		chunk_data.data.push(getValue(4));
	}
	//console.log("palette",JSON.stringify(chunk_data.data));
	palette = convertPalette(chunk_data.data);
	return chunk_data;
}

function chunkMatt() {
	let chunk_data = basicChunkInfo();
	return chunk_data;
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
	let return_palette = [0x00000000];
	//console.log("palette");
	for(let i = 0; i < temp_palette.length; i++) {
		return_palette.push(0x000000ff+((temp_palette[i]&0x0000ff)<<24)+((temp_palette[i]&0x00ff00)<<8)+((temp_palette[i]&0xff0000)>>8));
		//console.log(0x000000ff,((temp_palette[i]&0x0000ff)),((temp_palette[i]&0x00ff00)>>8),((temp_palette[i]&0xff0000)>>16));
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
