// 顾客端底部 Tab：点单 / 我的
// 微信仅支持一个原生 tabBar（商家端已占用），顾客端用自定义 Tab 组件
Component({
  properties: {
    // 当前激活项：'menu' 点单 / 'mine' 我的
    active: { type: String, value: 'menu' }
  },
  methods: {
    onTabTap: function(e) {
      const tab = e.currentTarget.dataset.tab;
      if (!tab || tab === this.data.active) return;
      this.triggerEvent('change', { tab: tab });
    }
  }
});
