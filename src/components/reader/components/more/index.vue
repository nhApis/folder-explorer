<style lang="scss">
.row-btn--more { 
  padding: 0 4px;   
  span {
    height: 2px;
    width: 2px;
    border-radius: 1px;
    background-color: #D9D9D9;
    margin-right: 2px;
    &:last-child {
      margin-right: 0px;
    }
  }
}
</style>

<template>
  <span flex="main:center cross:center" @click="onActive">
    <!-- 按钮 -->
    <span class="row-btn row-btn--more" flex="main:center cross:center">
      <a-icon type="caret-right" />
    </span>
    <!-- 编辑备注 -->
    <a-modal
      title="编辑备注"
      cancel-text="取消"
      ok-text="确定"
      :closable="false"
      :mask-closable="false"
      v-model="note.editing"
      width="400px"
      @ok="noteOnOk">
      <a-input
        v-model="note.currentNote"
        placeholder="备注内容 回车确认"
        ref="noteInput"
        @pressEnter="noteOnOk">
        <a-icon slot="prefix" type="tag" />
      </a-input>
    </a-modal>
    <!-- 编辑备注 结束 -->
  </span>
</template>

<script>
import { mapGetters } from 'vuex'
import { remote } from 'electron'
import note from './mixins/note'
import openFile from './mixins/openFile'
import scan from './mixins/scan'
import trash from './mixins/trash'
export default {
  mixins: [
    note,
    openFile,
    scan,
    trash
  ],
  props: {
    index: {
      type: Number,
      default: 0,
      required: false
    },
    value: {
      type: Object,
      default: () => ({}),
      required: false
    }
  },
  computed: {
    ...mapGetters([
      'SCAN_RESULT_FLAT_NOTE_NUM'
    ])
  },
  methods: {
    onActive (e) {
      const menu = new remote.Menu()
      // 备注
      menu.append(new remote.MenuItem({
        label: `${this.value.note === '' ? '添加' : '修改'}备注`,
        click: this.noteOnEdit
      }))
      menu.append(new remote.MenuItem({
        label: '删除备注',
        enabled: this.value.note !== '',
        click: () => { this.noteOnOk({ note: '' }) }
      }))
      menu.append(new remote.MenuItem({
        label: this.SCAN_RESULT_FLAT_NOTE_NUM > 0 ? `删除全部 ${this.SCAN_RESULT_FLAT_NOTE_NUM} 个备注` : '删除所有备注',
        enabled: this.SCAN_RESULT_FLAT_NOTE_NUM > 0,
        click: () => { this.noteOnClear() }
      }))
      menu.append(new remote.MenuItem({ type: 'separator'}))
      // 显示和隐藏
      menu.append(new remote.MenuItem({
        label: '隐藏',
        click: () => {
          this.$store.commit('SCAN_RESULT_UPDATE_ITEM_PROP', {
            path: `${this.value.dataPath}.isShow`,
            value: false
          })
        }
      }))
      menu.append(new remote.MenuItem({
        label: '折叠',
        enabled: this.value.isShowElements && this.value.isDirectory,
        click: () => {
          this.$store.commit('SCAN_RESULT_UPDATE_ITEM_PROP', {
            path: `${this.value.dataPath}.isShowElements`,
            value: false
          })
        }
      }))
      menu.append(new remote.MenuItem({
        label: '展开',
        enabled: (this.value.isShowElements === false) && this.value.isDirectory,
        click: () => {
          this.$store.commit('SCAN_RESULT_UPDATE_ITEM_PROP', {
            path: `${this.value.dataPath}.isShowElements`,
            value: true
          })
        }
      }))
      menu.append(new remote.MenuItem({ type: 'separator'}))
      // 扫描
      menu.append(new remote.MenuItem({
        label: '扫描',
        enabled: this.value.isDirectory,
        click: this.scanFolder
      }))
      menu.append(new remote.MenuItem({ type: 'separator'}))
      // 打开
      menu.append(new remote.MenuItem({
        label: '打开文件',
        enabled: this.value.isFile,
        click: this.openFile
      }))
      menu.append(new remote.MenuItem({
        label: '在 Finder 中显示',
        click: this.openFileInFolder
      }))
      menu.append(new remote.MenuItem({ type: 'separator'}))
      // 删除
      menu.append(new remote.MenuItem({
        label: `将${this.value.isFile ? '文件' : '文件夹'}移动到废纸篓`,
        click: this.moveItemToTrash
      }))
      menu.popup(remote.BrowserWindow.getFocusedWindow())
      e.stopPropagation()
    }
  }
}
</script>
