export interface Item { id: string; text: string; hint?: string }
export interface Lesson { id: string; stage: number; title: string; goal: string; items: Item[]; custom?: boolean }

export const STAGES = ['Câu văn', 'Ngữ cảnh', 'Nhấn nhá', 'Full bài', 'Bài của tôi', 'Luyện model'];

const mk = (lessonId: string, rows: (string | [string, string])[]): Item[] =>
  rows.map((r, i) => (typeof r === 'string' ? { id: `${lessonId}-${i + 1}`, text: r } : { id: `${lessonId}-${i + 1}`, text: r[0], hint: r[1] }));

// Dấu *…* đánh dấu chữ cần nhấn. Giữ nguyên id khi sửa nội dung để không mất liên kết với bản thu cũ.
export const LESSONS: Lesson[] = [
  {
    id: 'cau-1', stage: 0, title: 'Thanh điệu & âm cơ bản',
    goal: 'Giọng kể bình thường, tròn vành rõ chữ. Mỗi câu một hơi, không lên xuống quá đà.',
    items: mk('cau-1', [
      'Ba bà bán bánh bao bên bến Bình Ba.',
      'Mẹ mua mớ rau muống mới ở chợ Mơ.',
      'Trời trong xanh, gió thổi nhè nhẹ qua rặng tre làng.',
      'Chị Giang gửi giỏ quýt ngọt cho gia đình cô giáo.',
      'Những ngã rẽ nhỏ vẫn dẫn về ngõ cũ.',
      'Khuya khoắt, khách khứa khẽ khàng khép cửa.',
      'Nghe tiếng nghé ngọ, người nghệ nhân ngẩng nhìn ngọn núi.',
      'Thuyền xuôi dòng Hương, tiếng hò vọng giữa đêm khuya.',
      'Sáng sớm sương sa, sông Sài Gòn se sẽ sóng.',
      'Phố phường Hà Nội vào thu phảng phất hương hoa sữa.',
      'Uống nước nhớ nguồn, ăn quả nhớ kẻ trồng cây.',
      'Em yêu quê hương qua từng trang sách nhỏ.',
    ]),
  },
  {
    id: 'cau-2', stage: 0, title: 'Số, ngày tháng, tên riêng',
    goal: 'Đọc tự nhiên như khi nói, không đánh vần. Đây là phần giọng clone hay vấp nhất.',
    items: mk('cau-2', [
      'Năm hai nghìn không trăm hai mươi lăm, dân số Việt Nam đã vượt một trăm triệu người.',
      'Chuyến bay cất cánh lúc sáu giờ bốn mươi lăm phút sáng thứ Bảy.',
      'Giá vé là một triệu hai trăm năm mươi nghìn đồng, đã gồm thuế.',
      'Tỉ lệ tăng trưởng đạt bảy phẩy hai phần trăm trong quý ba.',
      'Từ Hà Nội vào Thành phố Hồ Chí Minh dài khoảng một nghìn bảy trăm ki-lô-mét.',
      'Công ty đặt văn phòng tại Đà Nẵng, Cần Thơ và Buôn Ma Thuột.',
      'Ứng dụng chạy trên iPhone, iPad và cả máy tính Windows.',
      'Anh Nguyễn Hoàng Minh và chị Trần Thị Thu Hương cùng dẫn chương trình.',
      'Podcast phát hành tập mới vào chín giờ tối thứ Năm hằng tuần.',
      'Trí tuệ nhân tạo, hay còn gọi là AI, đang thay đổi cách chúng ta làm việc.',
    ]),
  },
  {
    id: 'ctx-1', stage: 1, title: 'Kiểu câu',
    goal: 'Cùng một giọng nhưng đổi ngữ điệu theo kiểu câu: kể, hỏi, cảm thán, liệt kê.',
    items: mk('ctx-1', [
      ['Hôm nay chúng ta sẽ nói về một chủ đề rất quen thuộc.', 'Câu kể — mở đầu, giọng ấm, hạ nhẹ cuối câu.'],
      ['Bạn đã bao giờ tự hỏi vì sao mình hay trì hoãn chưa?', 'Câu hỏi — lên giọng nhẹ ở cuối, như hỏi thật.'],
      ['Thật không thể tin được!', 'Cảm thán — bất ngờ, nhưng đừng hét.'],
      ['Có ba điều cần nhớ: ngủ đủ, ăn sạch, và vận động mỗi ngày.', 'Liệt kê — ngắt rõ sau mỗi ý, ý cuối hạ giọng.'],
      ['Nếu bạn chỉ có năm phút mỗi ngày, hãy bắt đầu từ việc nhỏ nhất.', 'Câu điều kiện — ngắt sau vế đầu.'],
      ['Nhưng khoan đã, câu chuyện chưa dừng lại ở đó.', 'Chuyển ý — chậm lại, gây tò mò.'],
      ['Ông nói chậm rãi: "Việc gì cũng cần thời gian."', 'Trích lời — đổi nhẹ sắc giọng ở phần trong ngoặc kép.'],
      ['Và đó, chính là lý do tôi làm chương trình này.', 'Câu kết — chắc, chậm, dứt khoát.'],
    ]),
  },
  {
    id: 'ctx-2', stage: 1, title: 'Sắc thái',
    goal: 'Đọc đúng tâm trạng ghi trong gợi ý. Đây là dữ liệu để giọng clone có biểu cảm.',
    items: mk('ctx-2', [
      ['Xin chào, rất vui được gặp lại các bạn trong tập hôm nay.', 'Tươi, thân thiện — mỉm cười khi đọc.'],
      ['Tin này làm tôi suy nghĩ suốt cả tuần.', 'Trầm, suy tư.'],
      ['Bạn làm được mà, cứ thử thêm một lần nữa.', 'Động viên, ấm áp.'],
      ['Con số này cho thấy vấn đề nghiêm trọng hơn chúng ta tưởng.', 'Nghiêm túc, kiểu bản tin.'],
      ['Nói thật nhé, lúc đó tôi cũng run lắm.', 'Tâm tình, gần gũi như nói với bạn.'],
      ['Giữa đại ngàn Tây Nguyên, tiếng cồng chiêng vang lên trong sương sớm.', 'Thuyết minh phim tài liệu — chậm, có không gian.'],
      ['Chỉ còn ba ngày nữa thôi, đăng ký ngay hôm nay!', 'Quảng cáo — năng lượng cao, nhanh gọn.'],
      ['Chúc bạn một đêm ngon giấc, hẹn gặp lại vào tuần sau.', 'Nhẹ, êm — kết chương trình buổi tối.'],
    ]),
  },
  {
    id: 'nhan-1', stage: 2, title: 'Đổi chữ nhấn',
    goal: 'Cùng một câu, nhấn vào chữ in đậm. Nhấn bằng cách chậm lại và rõ hơn, không phải nói to hơn.',
    items: mk('nhan-1', [
      ['*Tôi* không nói anh ấy lấy tiền.', 'Nhấn "Tôi" — người khác nói, không phải tôi.'],
      ['Tôi *không* nói anh ấy lấy tiền.', 'Nhấn "không" — phủ nhận.'],
      ['Tôi không nói *anh ấy* lấy tiền.', 'Nhấn "anh ấy" — là người khác lấy.'],
      ['Tôi không nói anh ấy lấy *tiền*.', 'Nhấn "tiền" — lấy thứ khác.'],
      ['Điều quan trọng *nhất* không phải là tốc độ, mà là *hướng đi*.', 'Hai điểm nhấn, đối lập nhau.'],
      ['Chúng ta không thiếu ý tưởng. Chúng ta thiếu *kỷ luật*.', 'Dồn sức vào chữ cuối.'],
      ['Chỉ *một* thay đổi nhỏ thôi, kết quả đã khác *hoàn toàn*.', 'Nhấn hai đầu câu.'],
      ['Hãy làm *ngay hôm nay*, đừng đợi đến ngày mai.', 'Thúc giục.'],
    ]),
  },
  {
    id: 'nhan-2', stage: 2, title: 'Ngắt nghỉ & nhịp',
    goal: 'Dấu phẩy nghỉ ngắn, dấu chấm nghỉ dài, dấu ba chấm thì treo giọng. Tập điều khiển khoảng lặng.',
    items: mk('nhan-2', [
      ['Tôi mở cửa… và không còn ai ở đó nữa.', 'Treo giọng ở dấu ba chấm, nghỉ gần một giây.'],
      ['Chậm lại. Hít một hơi thật sâu. Rồi bắt đầu.', 'Ba câu ngắn, nghỉ đều sau mỗi dấu chấm.'],
      ['Có người chọn ở lại, có người chọn ra đi, và có người, đến giờ, vẫn chưa chọn.', 'Nhịp chậm dần về cuối.'],
      ['Nhanh lên, nhanh lên nữa, không kịp mất rồi!', 'Nhịp dồn, tăng tốc dần.'],
      ['Ngày xưa, ở một làng chài nhỏ ven biển, có hai anh em sống cùng người mẹ già.', 'Giọng kể chuyện, thong thả.'],
      ['Thứ nhất, chuẩn bị kỹ. Thứ hai, làm đến cùng. Thứ ba, đừng sợ sai.', 'Nhấn vào số thứ tự, nghỉ sau mỗi ý.'],
      ['Thành công — nếu có — cũng chỉ là phần thưởng phụ.', 'Phần chen giữa hai gạch đọc thấp và nhanh hơn.'],
      ['Bạn nghĩ sao? Tôi thì nghĩ… chúng ta nên thử.', 'Hỏi, ngập ngừng, rồi chốt.'],
    ]),
  },
  {
    id: 'full-1', stage: 3, title: 'Thuyết minh & podcast',
    goal: 'Đọc trọn đoạn một mạch, giữ năng lượng đều từ đầu tới cuối. Vấp thì thu lại cả đoạn.',
    items: mk('full-1', [
      ['Mỗi buổi sáng, khi thành phố còn chưa thức giấc, những người bán hàng rong đã bắt đầu một ngày mới. Họ đẩy xe qua từng con hẻm nhỏ, mang theo mùi xôi nóng, mùi cà phê và cả những câu chào quen thuộc. Với nhiều người, đó chỉ là bữa sáng vội. Nhưng với họ, đó là cả một cuộc mưu sinh bền bỉ, lặng lẽ, kéo dài qua bao nhiêu mùa mưa nắng.',
        'Thuyết minh phóng sự — ấm, chậm vừa, có hình ảnh.'],
      ['Xin chào các bạn, mình rất vui được gặp lại các bạn trong tập podcast tuần này. Hôm nay, chúng ta sẽ nói về một chuyện tưởng nhỏ mà không hề nhỏ: thói quen buổi sáng. Vì sao có người dậy sớm rất dễ dàng, còn có người đặt năm cái báo thức vẫn không dậy nổi? Mình đã thử nghiệm suốt ba mươi ngày, và kết quả làm chính mình cũng bất ngờ.',
        'Mở đầu podcast — tự nhiên như đang nói chuyện, có nụ cười.'],
      ['Về mặt kỹ thuật, pin lithium hoạt động nhờ sự di chuyển của các ion giữa hai điện cực. Khi sạc, ion đi từ cực dương sang cực âm. Khi dùng, chúng đi theo chiều ngược lại và giải phóng năng lượng. Nghe thì đơn giản, nhưng để quá trình này lặp lại hàng nghìn lần mà không hỏng, các kỹ sư đã phải mất hàng chục năm nghiên cứu.',
        'Giải thích kiến thức — rành mạch, nhấn vào thuật ngữ.'],
      ['Và như vậy, chúng ta đã đi hết hành trình hôm nay. Nếu bạn thấy nội dung này hữu ích, hãy chia sẻ cho một người bạn mà bạn nghĩ là đang cần nghe. Cảm ơn các bạn đã lắng nghe. Hẹn gặp lại vào tuần sau, cũng vào giờ này, và đừng quên: mỗi ngày tốt lên một chút là đủ.',
        'Kết chương trình — chậm lại, chân thành.'],
    ]),
  },
];

/** Các đoạn thử để so mẫu giọng clone; cố ý KHÔNG trùng với câu đã thu. */
export const TEST_TEXTS: { id: string; label: string; text: string }[] = [
  { id: 'tm', label: 'Thuyết minh', text: 'Dưới chân dãy Trường Sơn, con đường mòn năm xưa giờ đã thành quốc lộ. Nhưng với người dân nơi đây, ký ức về những chuyến xe đêm vẫn còn nguyên vẹn, như thể mọi chuyện chỉ vừa xảy ra hôm qua.' },
  { id: 'pc', label: 'Podcast', text: 'Chào các bạn, lại là mình đây. Tuần này có một câu hỏi làm mình nghĩ mãi: liệu bận rộn có thật sự đồng nghĩa với hiệu quả không? Mình đoán là không, và hôm nay mình sẽ kể cho các bạn nghe vì sao.' },
  { id: 'so', label: 'Số liệu & tên riêng', text: 'Theo báo cáo quý ba năm hai nghìn không trăm hai mươi sáu, doanh thu đạt một nghìn hai trăm tỉ đồng, tăng mười tám phần trăm. Riêng thị trường Đà Nẵng và Cần Thơ đóng góp gần một phần ba.' },
  { id: 'bc', label: 'Biểu cảm', text: 'Bạn có tin không? Chỉ sau đúng một tuần… mọi thứ đã thay đổi hoàn toàn! Thật lòng mà nói, chính mình cũng không ngờ tới.' },
];
