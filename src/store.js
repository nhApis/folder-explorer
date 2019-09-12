import Vue from 'vue'
import Vuex from 'vuex'
import persistedState from 'vuex-persistedstate'
import { message } from 'ant-design-vue'
import xmind from 'xmind'
import XMLJS from 'xml-js'
import width from 'string-width'
import { remote, shell, ipcRenderer } from 'electron'
import groupby from 'lodash.groupby'
import set from 'lodash.set'
import clone from 'lodash.clonedeep'
import translateFlat from '@/util/translate.flat.js'
import asciiBorder from '@/util/asciiBorder.js'

Vue.use(Vuex)

const stateDefault = {
  CACHE: {
    // 扫描的文件夹地址
    SCAN_FOLDER_PATH: '',
    // 扫描结果
    SCAN_RESULT: [],
    // 扫描结果 扁平化
    SCAN_RESULT_FLAT: []
  },
  // 数据库
  DB: {
    // 所有的备注信息 可以在重新扫描时自动恢复备注
    NOTES: {}
  },
  // 设置
  SETTING: {
    // 通用
    APP: {
      // 在导出之后打开文件
      OPEN_AFTER_EXPORT: true,
      // 在导出之后打开文件位置
      OPEN_FOLDER_AFTER_EXPORT: false,
      // 删除文件前确认
      DELETE_CONFIRM: true
    },
    // 导出相关的设置
    EXPORT: {
      // 系统存储
      STORE: {
        FILE_NAME: 'FolderExplorerBackup [ {YYYY}-{MM}-{DD} ]'
      },
      // 树形文本
      TREE_TEXT: {
        // 文件名
        FILE_NAME: 'FolderExplorer [ {YYYY}-{MM}-{DD} {HH}:{mm}:{ss} ]',
        // 元素格式化
        ELEMENT_FORMAT: '{tree}{name}{ext} ',
        // 备注格式化
        NOTE_FORMAT: ' // {note}',
        // 桥梁最短
        BRIDGE_MIN: 4,
        // 桥梁填充
        BRIDGE_CELL: '-',
        // 始终显示桥梁
        BRIDGE_ALWAYS: false,
        // 右侧对齐
        FLOAT_RIGHT: false,
        // 显示边框
        BORDER: false
      },
      // JSON
      TREE_JSON: {
        // 文件名
        FILE_NAME: 'FolderExplorer [ {YYYY}-{MM}-{DD} {HH}:{mm}:{ss} ]',
        // 使用 tab 缩进
        SPACE_USE_TAB: true,
        // 缩进大小
        SPACE_LENGTH: 4
      },
      // XMIND
      XMIND: {
        // 文件名
        FILE_NAME: 'FolderExplorer [ {YYYY}-{MM}-{DD} {HH}:{mm}:{ss} ]',
        // 标签页名称
        SHEET_NAME: 'Folder Explorer Sheet',
        // 元素格式化
        ELEMENT_FORMAT: '{name}',
        // 注释格式化
        NOTE_FORMAT: '{note}',
        // 标签格式化
        LABEL_FORMAT: '{ext}'
      },
      // XML
      XML: {
        // 文件名
        FILE_NAME: 'FolderExplorer [ {YYYY}-{MM}-{DD} {HH}:{mm}:{ss} ]',
        // 数据保存位置
        DATA_SPACE: 'ELEMENT',
        // 数据保存位置 选项
        DATA_SPACE_OPTIONS: [
          { label: '新子节点', value: 'ELEMENT' },
          { label: '自节点属性', value: 'ATTRIBUTES' }
        ]
      }
    },
    // 扫描相关
    SCAN: {
      // 忽略的文件夹
      IGNORE_PATH: [ '/node_modules', '/dist', '/.git' ],
      // 忽略的文件类型
      IGNORE_EXT: [ '.md' ],
      // 忽略文件
      IGNORE_FILE: false,
      // 忽略点开头的文件
      IGNORE_DOT_START_FILE: false,
      // 忽略点开头的文件夹
      IGNORE_DOT_START_FOLDER: false,
      // 扫描深度 0 为没有限制
      DEEP: 0
    }
  }
}

export default new Vuex.Store({
  plugins: [
    persistedState()
  ],
  state: clone(stateDefault),
  getters: {
    // 快速访问 CACHE
    SCAN_FOLDER_PATH: state => state.CACHE.SCAN_FOLDER_PATH,
    SCAN_RESULT: state => state.CACHE.SCAN_RESULT,
    SCAN_RESULT_FLAT: state => state.CACHE.SCAN_RESULT_FLAT,
    /**
     * 当前是否有扫描结果
     */
    HAS_SCAN_DATA: state => state.CACHE.SCAN_RESULT.length !== 0,
    /**
     * 根据扫描结果统计文件和文件夹的数量
     */
    SCAN_RESULT_FILE_AND_FOLDER_NUM: state => {
      const grouped = groupby(state.CACHE.SCAN_RESULT_FLAT, item => item.isFile ? 'file' : 'folder')
      return {
        file: (grouped.file || []).length,
        folder: (grouped.folder || []).length
      }
    },
    /**
     * 根据扫描结果统计文件类型分布
     */
    SCAN_RESULT_STATISTIC_EXT: state => {
      const grouped = groupby(state.CACHE.SCAN_RESULT_FLAT, 'ext')
      let result = []
      for (const key in grouped) {
        if (key !== '' && grouped.hasOwnProperty(key)) {
          result.push({
            name: key.replace(/^./, ''),
            value: grouped[key].length
          })
        }
      }
      return result
    },
    /**
     * 根据扫描结果统计设置建议选项 [ 忽略的文件夹路径 ]
     */
    SETTING_SCAN_IGNORE_PATH_OPTIONS: state => {
      let result = []
      function isFolderAndPush (itemArray, level = 1) {
        if (level > 2) return
        for (const item of itemArray) {
          if (item.isDirectory) {
            result.push(item.filePath)
            isFolderAndPush(item.elements, level + 1)
          }
        }
      }
      isFolderAndPush(state.CACHE.SCAN_RESULT)
      return result
    },
    /**
     * 根据扫描结果统计设置建议选项 [ 忽略的文件类型 ]
     */
    SETTING_SCAN_IGNORE_EXT_OPTIONS: state => {
      const grouped = groupby(state.CACHE.SCAN_RESULT_FLAT, 'ext')
      return Object.keys(grouped)
    }
  },
  mutations: {
    /**
     * 数据更新 [ 设置 ]
     */
    SETTING_UPDATE (state, { path, value }) {
      state.SETTING = set(state.SETTING, path, value)
    },
    /**
     * 数据更新 [ 目标文件夹地址 ]
     */
    SCAN_FOLDER_PATH_UPDATE (state, data) {
      state.CACHE.SCAN_FOLDER_PATH = data
    },
    /**
     * 数据更新 [ 扫描结果 ]
     */
    SCAN_RESULT_UPDATE (state, data) {
      state.CACHE.SCAN_RESULT = data
      state.CACHE.SCAN_RESULT_FLAT = translateFlat({
        data,
        notes: state.DB.NOTES
      })
    },
    /**
     * 数据更新 [ 扫描结果 扁平化 一项 ]
     */
    SCAN_RESULT_FLAT_UPDATE_ITEM (state, { index, item }) {
      // 更新 SCAN_RESULT_FLAT
      state.CACHE.SCAN_RESULT_FLAT.splice(index, 1, item)
      // 更新 NOTES 中的数据
      state.DB.NOTES[item.filePathFull] = item.note
    },
    /**
     * ELECTRON IPC [ 发送扫描文件夹请求 ]
     */
    IPC_FOLDER_SCAN (state) {
      ipcRenderer.send('IPC_FOLDER_SCAN', {
        folderPath: state.CACHE.SCAN_FOLDER_PATH,
        ignorePath: state.SETTING.SCAN.IGNORE_PATH,
        ignoreExt: state.SETTING.SCAN.IGNORE_EXT,
        ignoreFile: state.SETTING.SCAN.IGNORE_FILE,
        ignoreDotStartFile: state.SETTING.SCAN.IGNORE_DOT_START_FILE,
        ignoreDotStartFolder: state.SETTING.SCAN.IGNORE_DOT_START_FOLDER,
        deep: state.SETTING.SCAN.DEEP
      })
    },
    /**
     * ELECTRON IPC [ 通过文件选择窗口选择一个文件夹 ]
     */
    IPC_FOLDER_SELECT () {
      ipcRenderer.send('IPC_FOLDER_SELECT')
    },
    /**
     * ELECTRON IPC [ 导出文件 ]
     */
    IPC_EXPORT (state, { name, value }) {
      ipcRenderer.send('IPC_EXPORT', {
        name,
        value,
        openAfterExport: state.SETTING.APP.OPEN_AFTER_EXPORT,
        openFolderAfterExport: state.SETTING.APP.OPEN_FOLDER_AFTER_EXPORT
      })
    },
    /**
     * 重置软件所有数据
     */
    RESTORE (state, {
      include = [
        'CACHE',
        'DB',
        'SETTING'
      ]
    }) {
      include.forEach(key => {
        state[key] = clone(stateDefault[key])
      })
    },
    /**
     * 导出当前状态
     */
    STORE_EXPORT (state, {
      include = [
        'CACHE',
        'DB',
        'SETTING'
      ]
    } = {}) {
      let exportData = {}
      include.forEach(key => {
        exportData[key] = state[key]
      })
      this.commit('IPC_EXPORT', {
        name: `${require('@/util/replace.fileName.js').replace(state.SETTING.EXPORT.STORE.FILE_NAME)}.json`,
        value: JSON.stringify(exportData, null, 2)
      })
    },
    /**
     * 导入之前的备份
     */
    STORE_IMPORT (state, { data = {} }) {
      for (const key in state) {
        if (data.hasOwnProperty(key)) {
          state[key] = data[key]
        }
      }
    },
    /**
     * 导出 [ 树形文本 ]
     */
    async EXPORT_TREE_TEXT (state) {
      // 设置
      const setting = state.SETTING.EXPORT.TREE_TEXT
      // 开始处理
      let result = state.CACHE.SCAN_RESULT_FLAT
      // 获取最大宽度
      function getMaxWidth (result) {
        if (setting.FLOAT_RIGHT) {
          const elementLengthMax = result.reduce((max, { element }) => width(element) > max ? width(element) : max, 0)
          const noteLengthMax = result.reduce((max, { note }) => width(note) > max ? width(note) : max, 0)
          return elementLengthMax + noteLengthMax
        }
        else {
          return result.reduce((max, { element }) => {
            const length = width(element)
            return length > max ? length : max
          }, 0)
        }
      }
      // 生成合适的桥梁
      function bridgeAuto ({ element, note }, max) {
        if (note !== '' || setting.BRIDGE_ALWAYS) {
          let length = setting.BRIDGE_MIN
          if (setting.FLOAT_RIGHT) length += (max - width(`${element}${note}`))
          else length += (max - width(element))
          return setting.BRIDGE_CELL.repeat(length)
        }
        return ''
      }
      // 第一步 转换 element 和 note
      result = result.map(item => {
        const element = require('@/util/replace.element.js').replace(setting.ELEMENT_FORMAT, { data: item })
        const bridge = ''
        const note = item.note ? require('@/util/replace.note.js').replace(setting.NOTE_FORMAT, { data: item }) : ''
        return { element, bridge, note }
      })
      // 计算最大宽度
      const max = getMaxWidth(result)
      // 补齐
      result = result.map(item => ({ ...item, bridge: bridgeAuto(item, max) }))
      // 转换为字符串
      result = result.map(e => `${e.element}${e.bridge}${e.note}`)
      // 边框
      if (setting.BORDER) result = asciiBorder(result)
      // 导出
      this.commit('IPC_EXPORT', {
        name: `${require('@/util/replace.fileName.js').replace(setting.FILE_NAME)}.txt`,
        value: result.join('\n')
      })
    },
    /**
     * 导出 [ JSON ]
     */
    EXPORT_TREE_JSON (state) {
      const setting = state.SETTING.EXPORT.TREE_JSON
      const space = setting.SPACE_USE_TAB ? '\t' : setting.SPACE_LENGTH
      const text = JSON.stringify(state.CACHE.SCAN_RESULT, null, space)
      // 导出
      this.commit('IPC_EXPORT', {
        name: `${require('@/util/replace.fileName.js').replace(setting.FILE_NAME)}.json`,
        value: text
      })
    },
    /**
     * 导出 [ 思维导图 ]
     * https://github.com/leungwensen/xmind-sdk-javascript/blob/master/doc/api.md
     */
    async EXPORT_TREE_XMIND (state) {
      const setting = state.SETTING.EXPORT.XMIND
      // 初始化
      const workbook = new xmind.Workbook({
        firstSheetId: setting.SHEET_NAME,
        firstSheetName: setting.SHEET_NAME,
        rootTopicId: state.CACHE.SCAN_FOLDER_PATH,
        rootTopicName: state.CACHE.SCAN_FOLDER_PATH
      })
      function addTopics (items, parentTopic) {
        items.forEach(item => {
          const note = state.DB.NOTES[item.filePathFull]
          const replaceData = {
            data: {
              name: item.name,
              note,
              ext: item.ext
            }
          }
          const replace = require('@/util/replace.xmind.js').replace
          // 节点
          const topic = parentTopic.addChild({ title: replace(setting.ELEMENT_FORMAT, replaceData) })
          // 注释
          const topicNote = replace(setting.NOTE_FORMAT, replaceData)
          if (topicNote) topic.setNotes(topicNote)
          // 标签
          const topicLabel = replace(setting.LABEL_FORMAT, replaceData)
          if (topicLabel) topic.setLabels(topicLabel)
          // 子级
          if (item.isDirectory) addTopics(item.elements, topic)
        })
      }
      addTopics(state.CACHE.SCAN_RESULT, workbook.getPrimarySheet().rootTopic)
      // 这里不使用默认的导出方法
      const pathSelect = await remote.dialog.showSaveDialog(remote.BrowserWindow.getFocusedWindow(), {
        defaultPath: `${require('@/util/replace.fileName.js').replace(state.SETTING.EXPORT.XMIND.FILE_NAME)}.xmind`
      })
      if (pathSelect.canceled === false) {
        workbook.save(pathSelect.filePath)
        if (state.SETTING.APP.OPEN_AFTER_EXPORT) shell.openItem(pathSelect.filePath)
        else if (state.SETTING.APP.OPEN_FOLDER_AFTER_EXPORT) shell.showItemInFolder(pathSelect.filePath)
        message.success('内容已经导出')
      }
    },
    /**
     * 导出 [ XML ]
     * https://github.com/nashwaan/xml-js
     */
    EXPORT_TREE_XML (state) {
      const setting = state.SETTING.EXPORT.XML
      /**
       * 创建标签
       * @param {String} name 标签名
       * @param {String} elements 元素
       */
      function el (name, elements, attributes) {
        return {
          type: 'element',
          name,
          ...elements ? { elements } : {},
          ...attributes ? { attributes } : {}
        }
      }
      /**
       * 创建文字标签
       * @param {String} name 标签名
       * @param {String} value 值
       */
      function text (name, value) {
        return el(name, [{ type: 'text', text: value }])
      }
      /**
       * 传入一个对象 返回这个对象删除 elements 字段后的结果
       * @param {Object} obj 过滤掉 elements 字段
       */
      function removeElementsKey (obj) {
        let result = {}
        Object.keys(obj).forEach(key => {
          if (key !== 'elements') {
            result[key] = obj[key]
          }
        })
        return result
      }
      // 循环
      function maker (itemArray) {
        let result = []
        itemArray.forEach(item => {
          // 数据保存到节点属性上
          if (setting.DATA_SPACE === 'ATTRIBUTES') {
            result.push(el('element', (item.isDirectory && item.elements.length > 0) ? maker(item.elements) : [], removeElementsKey(item)))
          }
          // 数据保存为节点
          else if (setting.DATA_SPACE === 'ELEMENT') {
            result.push(
              el('element', [
                ...Object.keys(item).filter(e => e !== 'elements').map(e => text(e, item[e])),
                ...(item.isDirectory && item.elements.length > 0) ? [ el('elements', maker(item.elements)) ] : []
              ])
            )
          }
        })
        return result
      }
      let data = {
        declaration: { attributes: { version: "1.0", encoding: "utf-8" } },
        elements: []
      }
      data.elements = [
        el('folder-explorer', maker(state.CACHE.SCAN_RESULT))
      ]
      // 导出
      this.commit('IPC_EXPORT', {
        name: `${require('@/util/replace.fileName.js').replace(state.SETTING.EXPORT.XML.FILE_NAME)}.xml`,
        value: XMLJS.js2xml(data, { spaces: '\t' })
      })
    }
  }
})
