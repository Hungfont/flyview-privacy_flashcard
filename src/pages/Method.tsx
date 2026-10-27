const PRINCIPLES = [
  {
    icon: '📅',
    title: 'Ôn tập cách quãng (Spaced repetition)',
    body:
      'Không ôn thì sau khoảng 1 tuần ta quên phần lớn từ mới (đường cong quên lãng của Ebbinghaus). Ôn đúng lúc sắp quên làm trí nhớ bền thêm sau mỗi lần ôn. Một phân tích tổng hợp 48 thí nghiệm (3.411 người học) cho thấy học giãn cách có tác dụng từ trung bình đến lớn với việc học ngoại ngữ. Khoảng cách dài hơn giúp nhớ lâu hơn. Nghiên cứu 8 năm của Bahrick cũng cho kết quả tương tự.',
    app: 'Website dùng thuật toán FSRS (thuật toán mới của Anki) để tính ngày ôn riêng cho từng từ, nhắm tỷ lệ nhớ khoảng 90%. FSRS cần ít lượt ôn hơn SM-2 khoảng 20–30% để đạt cùng mức nhớ.',
  },
  {
    icon: '🧠',
    title: 'Chủ động nhớ lại (Retrieval practice)',
    body:
      'Tự kéo thông tin ra khỏi trí nhớ hiệu quả hơn nhiều so với đọc lại (hiệu ứng kiểm tra). Lợi ích lớn nhất khi việc nhớ lại hơi khó nhưng vẫn thành công.',
    app: 'Thẻ chỉ hiện từ tiếng Anh, bạn phải tự nhớ nghĩa trước khi lật. Mặt trước có thêm mô tả tiếng Anh để đoán nghĩa, mặt sau có nghĩa tiếng Việt kèm từ tiếng Trung (chữ Hán + pinyin) để học song ngữ. Có trắc nghiệm, nghe chọn từ, điền từ vào câu, chọn từ tiếng Anh theo từ tiếng Trung. Với từ cốt lõi đã quen, website đổi sang gõ từ tiếng Anh từ nghĩa tiếng Việt (khó hơn).',
  },
  {
    icon: '🔁',
    title: 'Gặp lại nhiều lần, xử lý sâu (Paul Nation)',
    body:
      'Để một từ “bám rễ” cần khoảng 10–16 lần gặp có ý nghĩa. Ngoài số lần lặp, chất lượng xử lý cũng quan trọng: hiểu nghĩa, thấy từ trong câu, tự dùng từ.',
    app: 'Mỗi từ được gặp theo nhiều dạng: thẻ, câu ví dụ, nghe, điền chỗ trống, gõ lại. Lịch ôn lặp đi lặp lại trong nhiều tuần.',
  },
  {
    icon: '✍️',
    title: 'Tự tạo nội dung (Generation effect)',
    body: 'Thông tin do chính mình tạo ra (một câu, một liên tưởng) được nhớ tốt hơn thông tin chỉ đọc qua.',
    app: 'Mỗi thẻ có ô tự đặt câu tiếng Anh và tiếng Trung. Ô này tự mở cho từ hay quên, và câu của bạn sẽ hiện lại khi ôn.',
  },
  {
    icon: '🎧',
    title: 'Mã hóa kép, đa giác quan (Dual coding)',
    body: 'Kết hợp nhiều kênh (nhìn chữ, nghe âm, đọc to, ngữ cảnh) tạo nhiều đường dẫn tới cùng một từ.',
    app: 'Tự phát âm khi gặp từ mới, có nút nghe cả câu ví dụ, có phiên âm IPA, câu hỏi nghe chọn từ, và nút “Đọc thử” chấm phát âm của bạn kèm gợi ý sửa.',
  },
  {
    icon: '🧩',
    title: 'Chia nhỏ và nhóm theo chủ đề, ôn thì trộn lẫn',
    body:
      'Trí nhớ ngắn hạn chỉ giữ được vài mục cùng lúc, nên học theo nhóm nhỏ có liên quan giúp hiểu nhanh. Khi ôn, trộn các chủ đề (interleaving) buộc não phân biệt kỹ hơn, giúp nhớ lâu hơn.',
    app: 'Từ mới được học theo nhóm 10 từ cùng chủ đề. Phần ôn tập thì xáo trộn mọi chủ đề.',
  },
  {
    icon: '😌',
    title: 'Giảm lo âu khi học ngoại ngữ (Horwitz)',
    body:
      'Lo âu khi học ngoại ngữ làm giảm khả năng ghi nhớ. Ngược lại, khi vốn từ tăng thì sự lo âu cũng giảm. Sai rồi được sửa ngay là một phần bình thường của việc học.',
    app: 'Không có điểm trừ, không màu đỏ gắt. Câu sai chỉ quay lại cuối nhóm kèm lời động viên. Khi thẻ ôn dồn hơn 150, website tự giảm số từ mới để bạn không bị quá tải.',
  },
  {
    icon: '🌱',
    title: 'Hình thành thói quen (Lally 2010, BJ Fogg)',
    body:
      'Trung bình mất 66 ngày (từ 18 đến 254 ngày tùy người) để một hành vi thành tự động. Yếu tố quyết định là lặp lại đều đặn trong cùng bối cảnh. Bỏ lỡ một ngày không ảnh hưởng đáng kể. Ngược lại, chuỗi ngày quá khắt khe dễ khiến người học bỏ cuộc khi lỡ đứt chuỗi.',
    app: 'Mục tiêu nhỏ mỗi ngày (mặc định 20 thẻ). Chuỗi ngày được tính theo kiểu “không bỏ 2 ngày liền” và có lịch học dạng ô màu để thấy mình tiến bộ.',
  },
  {
    icon: '🌙',
    title: 'Giấc ngủ củng cố trí nhớ',
    body: 'Sau một giấc ngủ, người học nhớ lại bản dịch của từ nhanh hơn so với cùng khoảng thời gian thức.',
    app: 'Gợi ý ôn một lượt ngắn buổi tối và ngủ đủ giấc. Đừng học thêm từ mới khi đã quá mệt.',
  },
]

const SOURCES = [
  ['Meta-analysis về spacing trong học ngôn ngữ thứ hai (Frontiers in Psychology, 2021)', 'https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.757262/pdf'],
  ['Bahrick et al. (1993): duy trì từ vựng ngoại ngữ trong 8 năm', 'https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.1993.tb00571.x/'],
  ['Retrieval practice & spacing trong học từ vựng L2 (Michigan State University)', 'https://d.lib.msu.edu/etd/48649'],
  ['Anki: thuật toán FSRS và SM-2', 'https://docs.ankiweb.net/faqs/what-spaced-repetition-algorithm'],
  ['Paul Nation: từ vựng được học như thế nào', 'https://ejournal.atmajaya.ac.id/index.php/ijelt/article/view/1458'],
  ['Học từ vựng (Wikipedia, tổng hợp Nation)', 'https://en.wikipedia.org/wiki/Vocabulary_learning'],
  ['Lally et al. (2010): mất bao lâu để hình thành thói quen', 'https://www.thebehavioralscientist.com/articles/how-long-to-form-a-habit'],
  ['Giấc ngủ và học ngôn ngữ trên ứng dụng (CogSci 2020)', 'https://escholarship.org/uc/item/27r4h31z'],
  ['Giảm lo âu ngoại ngữ bằng cách tăng thành tích từ vựng', 'https://clt.kku.edu.sa/sites/clt.kku.edu.sa/files/2025-04/Reducing-Language-Anxiety-by-Increasing-Language-Achievement.pdf'],
]

export default function Method() {
  return (
    <div className="method">
      <section className="panel">
        <h2>Vì sao website này giúp bạn nhớ từ?</h2>
        <p className="muted">
          Mỗi tính năng dựa trên một kết quả nghiên cứu về tâm lý học trí nhớ và hành vi. Không có cách nào nhớ từ mà không
          cần lặp lại. Mục tiêu là để mỗi phút học cho kết quả nhiều nhất.
        </p>
      </section>
      {PRINCIPLES.map((p) => (
        <section key={p.title} className="panel principle">
          <h3>{p.icon} {p.title}</h3>
          <p>{p.body}</p>
          <p className="applied"><b>Trong website:</b> {p.app}</p>
        </section>
      ))}
      <section className="panel">
        <h3>Một ngày học mẫu (~30–60 phút)</h3>
        <ol>
          <li>Ôn hết thẻ đến hạn trước (5–20 phút).</li>
          <li>Học từ mới ★★★ theo nhóm 10 từ: làm quen → kiểm tra nhanh. Nghỉ 2–3 phút giữa các nhóm.</li>
          <li>Đọc lướt các từ ★★/★ của ngày, nghe phát âm, thêm vào ôn tập những từ bạn thích.</li>
          <li>Buổi tối: ôn lại một lượt ngắn trước khi ngủ.</li>
        </ol>
      </section>
      <section className="panel">
        <h3>Nguồn tham khảo</h3>
        <ul className="sources">
          {SOURCES.map(([t, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{t}</a></li>)}
        </ul>
      </section>
    </div>
  )
}
