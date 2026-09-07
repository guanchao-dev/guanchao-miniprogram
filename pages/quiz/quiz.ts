import { homeApi } from '../../services/api'
import { requireLogin } from '../../utils/auth'
import { showError, toast } from '../../utils/format'
import { enqueueUnlocks, flushUnlocks } from '../../utils/unlock'

Page({
  data: {
    quizId: '',
    quiz: {},
    questions: [],
    answers: {} as Record<string, string>,
    result: null as any
  },

  onLoad(query: any) {
    const id = (query && query.id) || 'quiz_tide_intro'
    this.setData({ quizId: id })
    homeApi.quizQuestions(id)
      .then((quiz) => this.setData({
        quiz,
        questions: quiz.questions || []
      }))
      .catch((err) => showError(err, '题目加载失败'))
  },

  onPick(e: any) {
    if (this.data.result) return
    const { qid, oid } = e.currentTarget.dataset
    this.setData({ [`answers.${qid}`]: oid })
  },

  onSubmit() {
    if (!requireLogin()) return
    const { quizId, questions, answers } = this.data
    const list = (questions as any[]).map((q) => ({
      questionId: q.id,
      optionId: answers[q.id]
    }))
    if (list.some((a) => !a.optionId)) {
      toast('请答完所有题目')
      return
    }
    homeApi.quizSubmit(quizId, {
      attemptId: `att_${Date.now()}`,
      answers: list
    })
      .then((result) => {
        this.setData({ result })
        enqueueUnlocks((result && result.unlockedMedalIds) || [], 'quiz')
        flushUnlocks(this)
      })
      .catch((err) => showError(err, '提交失败'))
  }
})
