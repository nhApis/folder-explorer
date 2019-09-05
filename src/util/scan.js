import fs from 'fs'
import path from 'path'
import contains from 'contains-path'
import { BrowserWindow, dialog } from 'electron'

/**
 * 返回传入目录的子文件数据
 * @param {Object} param0 {String} folderPath 文件夹路径
 * @param {Object} param0 {Boolean} needCheckIsFolder 判断传入的是否为文件夹
 */
async function scan ({
	folderPath,
	ignorePath,
	ignoreExt,
	ignoreFile,
	ignoreDotStartFile,
	deep,
	levelCurrent = 1,
	needCheckIsFolder = false,
	rootFolderPath = folderPath
}) {
	let result = []
	// 层级检测
	if (deep !== 0 && levelCurrent > deep) return result
	// 防止拖拽导入的路径不是文件夹，这个判断只在递归的第一次触发
	if (needCheckIsFolder && !await fs.statSync(folderPath).isDirectory()) return result
	// 检查该路径是否忽略
	function isIgnoreByPath (value) {
		let result = false
		for (const ignoreText of ignorePath) {
			if (contains(value, ignoreText)) {
				result = true
			}
		}
		return result
	}
	// 获得文件夹的内容
	const files = await fs.readdirSync(folderPath)
	for (const filename of files) {
		// path
		const filePathFull = path.join(folderPath, filename)
		const filePath = filePathFull.replace(rootFolderPath, '')
		// 是否为文件或者文件夹
		const stat = await fs.statSync(filePathFull)
		const isFile = stat.isFile()
		const isDirectory = stat.isDirectory()
		// 是文件的话 如果设置不扫描文件 跳过这个文件
		if (isFile && ignoreFile) continue
		// 判断是否根据路径忽略
		if (isIgnoreByPath(filePath)) continue
		// 解析路径
		const filePathParsed = path.parse(filePath)
		const filePathFullParsed = path.parse(filePathFull)
		// 忽略点开头的文件
		if (isFile && ignoreDotStartFile && filePathParsed.name[0] === '.') continue
		// 是文件的话 判断是否根文件类型忽略
		if (isFile && ignoreExt.indexOf(filePathParsed.ext) >= 0) continue
		result.push({
			// stat
			stat: {
				...stat,
				isFile,
				isDirectory
			},
			// path
			filePath,
			filePathParsed,
			filePathFull,
			filePathFullParsed,
			// 如果是文件夹，其子文件或者子文件夹
			children: isDirectory ? await scan({
				folderPath: filePathFull,
				ignorePath,
				ignoreExt,
				ignoreFile,
				ignoreDotStartFile,
				deep,
				levelCurrent: levelCurrent + 1,
				rootFolderPath
			}) : []
		})
	}
	return result
}

export default scan
