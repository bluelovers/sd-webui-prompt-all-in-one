import * as Vue from 'vue'
import App from './App.vue'
import toastr from 'toastr'
import VueClipboard from 'vue-clipboard3'
const {toClipboard} = VueClipboard()
import CommonMixin from "@/mixins/commonMixin"
import common from "@/utils/common"
import tippy from "tippy.js"

onUiLoaded(() => {
    const div = document.createElement('div')
    div.id    = 'physton-prompt-all-in-one'
    common.gradioApp().appendChild(div)
    const app = Vue.createApp(App)

    app.config.globalProperties.$toastr    = toastr
    app.config.globalProperties.$copyText  = toClipboard
    app.config.globalProperties.$tippyList = []
    app.mixin(CommonMixin)
    app.directive('tooltip', {
        mounted(el, binding) {
            // data-tippy-content
            el.setAttribute('data-tippy-content', binding.value)
            // 如果有 unaffected 属性，则不受 localStorage 控制
            let unaffected = el.getAttribute('unaffected')
            unaffected     = unaffected === null ? false : unaffected === 'true'
            const instance = tippy(el, {
                placement: 'bottom',
                theme: 'light',
                allowHTML: true,
                onCreate(instance, partialProps) {
                    if (unaffected) return
                    const enable = localStorage.getItem('phystonPromptEnableTooltip') === 'true'
                    if (!enable) {
                        instance.disable()
                    }
                },
            })
            el.$tippyInstance = instance
            if (!unaffected) app.config.globalProperties.$tippyList.push(instance)
        },
        updated(el, binding) {
            el.setAttribute('data-tippy-content', binding.value)
            el.$tippyInstance.setContent(binding.value)
        }
    })

    app.mount(div)
})

