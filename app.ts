import { getUser, isLoggedIn } from './utils/auth'

App({
  globalData: {
    spotId: 'spot_qd_shilaoren'
  },

  onLaunch() {
    this.globalData.loggedIn = isLoggedIn()
    this.globalData.user = getUser()
  }
})
