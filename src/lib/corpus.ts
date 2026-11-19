import type { Lesson } from './curriculum';

// Bộ câu để train model riêng: ~240 câu đủ kiểu (kể, hỏi, cảm thán, số liệu, tâm tình), mỗi câu đọc 4–12 giây.
// Model học luôn phong cách đọc, nên hãy đọc đúng chất giọng bạn muốn dùng cho thuyết minh và podcast.
// Số được viết bằng chữ để lời đọc khớp tuyệt đối với văn bản. Chỉ thêm câu ở cuối mỗi bài: id tính theo thứ tự.
const SETS: [string, string][] = [
  ['Đời thường', `
Sáng nay tôi dậy sớm hơn mọi ngày, pha một ấm trà rồi ngồi nhìn ra khoảng sân còn ướt sương.
Con hẻm nhỏ nhà tôi lúc nào cũng rộn ràng tiếng rao của những gánh hàng buổi sớm.
Bạn có để ý không, mùi cà phê rang luôn làm một buổi sáng trở nên dễ chịu hơn hẳn.
Mẹ tôi vẫn giữ thói quen đi chợ lúc năm giờ, dù siêu thị đã mở ngay đầu ngõ.
Chiều cuối tuần, cả nhà quây quần bên mâm cơm, chuyện trò đủ thứ trên đời.
Tôi thích những ngày mưa lâm râm, khi cả thành phố như chậm lại một nhịp.
Ông bà ta nói chẳng sai, bán anh em xa mua láng giềng gần.
Đôi khi chỉ cần một tin nhắn hỏi thăm cũng đủ làm ai đó vui cả ngày.
Quán phở đầu đường đã bán hơn ba mươi năm, vậy mà hương vị vẫn y như cũ.
Trẻ con trong xóm ùa ra sân chơi ngay khi tiếng trống tan trường vừa dứt.
Cuộc sống ở quê chậm rãi, nhưng chưa bao giờ thiếu những điều thú vị.
Tôi vẫn nhớ như in cái Tết đầu tiên xa nhà, vừa háo hức vừa chạnh lòng.
Hàng xóm mới chuyển đến là một cặp vợ chồng trẻ, rất hay cười và nhiệt tình.
Bữa cơm nhà không cần cầu kỳ, miễn là có đủ mặt mọi người.
Mỗi lần về thăm quê, tôi lại thấy con đường làng ngắn hơn trong ký ức.
Cô bán xôi nhớ mặt từng khách quen, nhớ cả việc ai thích thêm nhiều hành phi.
Thành phố về đêm lên đèn rực rỡ, nhưng góc phố tôi ở vẫn giữ được vẻ yên tĩnh.
Có những thói quen nhỏ, giữ đủ lâu, sẽ âm thầm thay đổi cả một con người.
Anh bạn tôi bỏ việc văn phòng để về mở một tiệm bánh mì nhỏ, và chưa từng hối hận.
Trời trở gió rồi đấy, bạn ra đường nhớ mang thêm một chiếc áo khoác nhé.
Chúng tôi ngồi với nhau đến tận khuya, nhắc lại những chuyện cũ thời còn đi học.
Một ngày của tôi thường bắt đầu bằng việc tưới mấy chậu cây ngoài ban công.
Chuyến xe buýt số tám lúc nào cũng đông, nhưng ai cũng sẵn lòng nhường ghế cho người già.
Ngoại tôi nấu ăn không cần công thức, chỉ nêm nếm bằng kinh nghiệm của cả một đời.
Dọn nhà cuối năm mệt thật, nhưng nhìn căn phòng gọn gàng thì thấy rất đáng.
Tiếng chuông gió trước hiên leng keng mỗi khi có cơn gió nhẹ lướt qua.
Tôi học được rằng, lắng nghe đôi khi quan trọng hơn rất nhiều so với việc cho lời khuyên.
Buổi tối, hai cha con thường đi bộ quanh hồ và kể cho nhau nghe chuyện trong ngày.
Chiếc xe đạp cũ ấy đã theo tôi suốt những năm tháng sinh viên.
Hạnh phúc, suy cho cùng, nằm ở những điều rất đỗi bình thường.`],
  ['Thuyết minh thiên nhiên', `
Khi bình minh vừa ló dạng, cả cánh rừng bừng tỉnh trong tiếng chim gọi bầy.
Dòng sông uốn lượn qua thung lũng, mang phù sa bồi đắp cho những cánh đồng hai bên bờ.
Trên đỉnh núi quanh năm mây phủ, nhiệt độ có thể xuống dưới không độ vào mùa đông.
Loài voọc chà vá chân nâu chỉ còn vài trăm cá thể sinh sống trên bán đảo Sơn Trà.
Mỗi năm, hàng triệu con chim di cư bay qua vùng đất ngập nước này để tránh rét.
Rạn san hô là mái nhà của gần một phần tư số loài sinh vật biển trên hành tinh.
Mùa nước nổi, cả vùng Đồng Tháp Mười biến thành một biển nước mênh mông.
Trong lòng hang Sơn Đoòng tồn tại cả một khu rừng nguyên sinh với hệ sinh thái riêng.
Những thửa ruộng bậc thang ở Mù Cang Chải là kết quả lao động của nhiều thế hệ.
Con báo gấm di chuyển nhẹ đến mức gần như không để lại một tiếng động nào.
Cây đước cắm bộ rễ chằng chịt xuống bùn, giữ đất và chắn sóng cho cả vùng ven biển.
Vào mùa khô, đàn voi phải đi hàng chục cây số mỗi ngày để tìm nguồn nước.
Sương muối phủ trắng đỉnh Fansipan, tạo nên một khung cảnh hiếm thấy ở xứ nhiệt đới.
Rùa biển mẹ quay về đúng bãi cát nơi nó từng chào đời để đẻ trứng.
Dải Trường Sơn hùng vĩ chạy dọc đất nước, là ranh giới tự nhiên giữa hai vùng khí hậu.
Một cây cổ thụ có thể là nơi trú ngụ của hàng trăm loài côn trùng và chim chóc.
Nước từ thượng nguồn đổ về, cuốn theo đất đá, tạo thành những dòng thác trắng xoá.
Cá heo giao tiếp với nhau bằng những chuỗi âm thanh mà tai người khó lòng phân biệt.
Hoàng hôn trên phá Tam Giang nhuộm cả mặt nước thành một màu tím sẫm.
Chỉ sau một trận mưa đầu mùa, cả sa mạc bỗng nở rộ hoa.
Loài ong đóng vai trò thụ phấn cho hơn một phần ba số cây lương thực của con người.
Băng tan ở hai cực đang làm mực nước biển dâng lên từng năm.
Trong bóng tối của đại dương sâu thẳm, nhiều sinh vật tự phát ra ánh sáng.
Vườn quốc gia Cúc Phương là khu bảo tồn thiên nhiên đầu tiên của Việt Nam.
Gió mùa đông bắc tràn về mang theo cái lạnh khô hanh đặc trưng của miền Bắc.
Đàn kiến tha mồi theo một hàng dài ngay ngắn, không con nào lạc lối.
Thiên nhiên luôn có cách tự chữa lành, nếu con người cho nó đủ thời gian.
Núi lửa phun trào tàn phá mọi thứ, nhưng cũng để lại lớp đất màu mỡ bậc nhất.
Tiếng suối róc rách hoà cùng tiếng lá xào xạc, tạo nên bản nhạc của núi rừng.
Và cứ thế, vòng tuần hoàn của sự sống lại bắt đầu thêm một lần nữa.`],
  ['Kiến thức & công nghệ', `
Về cơ bản, trí tuệ nhân tạo học từ dữ liệu, giống như cách con người học từ kinh nghiệm.
Một chiếc điện thoại ngày nay mạnh hơn cả dàn máy tính đã đưa con người lên Mặt Trăng.
Ánh sáng mất khoảng tám phút để đi từ Mặt Trời đến Trái Đất.
Bộ não con người có khoảng tám mươi sáu tỉ tế bào thần kinh liên kết với nhau.
Internet vạn vật cho phép tủ lạnh, đèn và máy giặt trò chuyện được với nhau.
Vắc xin hoạt động bằng cách dạy hệ miễn dịch nhận diện kẻ thù từ trước.
Điện mặt trời đã rẻ hơn gần chín mươi phần trăm chỉ trong vòng mười năm qua.
Mã nguồn mở nghĩa là bất kỳ ai cũng có thể xem, sửa và chia sẻ phần mềm đó.
Giấc ngủ sâu là lúc cơ thể sửa chữa tế bào và bộ não sắp xếp lại ký ức.
Một tỉ giây tương đương với gần ba mươi hai năm, con số này khiến nhiều người bất ngờ.
Điện toán đám mây thực chất là thuê máy tính của người khác qua mạng.
Thuật toán gợi ý quyết định phần lớn những gì bạn nhìn thấy trên mạng xã hội.
Pin thể rắn được kỳ vọng sẽ giúp xe điện chạy xa gấp đôi sau mỗi lần sạc.
Lạm phát là hiện tượng cùng một số tiền nhưng mua được ít hàng hoá hơn trước.
Kính viễn vọng không gian cho chúng ta nhìn thấy ánh sáng từ hàng tỉ năm trước.
Mật khẩu mạnh nên dài ít nhất mười hai ký tự và không dùng lại ở nhiều nơi.
Cơ thể người trưởng thành chứa khoảng sáu mươi phần trăm là nước.
Lãi kép được ví như kỳ quan thứ tám của thế giới, vì tiền tự sinh ra tiền.
Dữ liệu lớn chỉ thật sự có giá trị khi chúng ta biết đặt đúng câu hỏi.
Robot hút bụi dùng cảm biến để vẽ lại bản đồ căn nhà của bạn.
Vi khuẩn đường ruột ảnh hưởng đến cả tâm trạng, chứ không riêng gì tiêu hoá.
Một mô hình ngôn ngữ dự đoán từ tiếp theo dựa trên hàng tỉ câu văn đã đọc.
In ba chiều giờ đây có thể tạo ra cả một ngôi nhà chỉ trong vài ngày.
Động đất xảy ra khi các mảng kiến tạo trượt lên nhau và giải phóng năng lượng.
Chuỗi khối là một cuốn sổ cái mà không ai có thể tự ý sửa đổi.
Tập thể dục ba mươi phút mỗi ngày giúp giảm rõ rệt nguy cơ mắc bệnh tim mạch.
Mạng năm gờ nhanh hơn thế hệ trước hàng chục lần, với độ trễ gần như bằng không.
Khoa học không đưa ra chân lý tuyệt đối, mà đưa ra lời giải thích tốt nhất hiện có.
Thói quen được hình thành qua ba bước, gồm tín hiệu, hành động và phần thưởng.
Hiểu được nguyên lý, bạn sẽ không còn phải học thuộc lòng từng chi tiết nữa.`],
  ['Dẫn podcast', `
Xin chào các bạn, chào mừng các bạn đã quay trở lại với chương trình của chúng mình.
Hôm nay mình có một câu chuyện khá thú vị, và mình tin là bạn sẽ muốn nghe đến cuối.
Trước khi bắt đầu, mình muốn gửi lời cảm ơn đến tất cả các bạn đã nhắn tin góp ý tuần rồi.
Nếu bạn mới nghe lần đầu thì đây là nơi chúng ta nói về những điều nhỏ làm nên thay đổi lớn.
Được rồi, không để các bạn chờ lâu nữa, chúng ta vào chủ đề chính ngay thôi.
Tuần trước có một bạn hỏi mình thế này, và mình nghĩ câu hỏi đó đáng để dành hẳn một tập.
Mình sẽ chia tập hôm nay làm ba phần, phần nào cũng ngắn gọn và dễ áp dụng.
Nói thật là lúc chuẩn bị nội dung này, chính mình cũng phải nghĩ lại khá nhiều thứ.
Bạn cứ pha một ly nước, ngồi thật thoải mái, rồi mình cùng trò chuyện nhé.
Đây là phần mà mình thích nhất trong cả tập, nên bạn đừng tua qua nha.
Mình biết nghe có vẻ hơi ngược đời, nhưng bạn cứ nghe mình giải thích đã.
Câu chuyện này bắt đầu từ một buổi chiều rất bình thường cách đây hai năm.
Tới đây chắc sẽ có bạn thắc mắc, vậy rốt cuộc mình nên làm gì trước?
Để mình kể cho bạn nghe một ví dụ rất thật, từ chính công việc của mình.
Chúng ta tạm nghỉ một chút, rồi quay lại với phần quan trọng nhất của hôm nay.
Quay trở lại với câu hỏi ban đầu, mình nghĩ câu trả lời nằm ở chữ kiên nhẫn.
Nếu phải tóm gọn cả tập này trong một câu, thì mình sẽ nói thế này.
Bạn không cần làm hết mọi thứ mình vừa kể, chỉ cần chọn một việc và bắt đầu.
Mình rất muốn nghe câu chuyện của bạn, nên đừng ngại để lại bình luận nhé.
Nếu thấy tập này hữu ích, bạn hãy chia sẻ cho một người bạn đang cần nghe nó.
Tuần sau, chúng ta sẽ gặp một vị khách đặc biệt mà mình đã hẹn từ rất lâu.
Cảm ơn bạn đã dành thời gian quý báu của mình để lắng nghe đến tận phút này.
Mình là người dẫn chương trình, và hẹn gặp lại các bạn trong tập tiếp theo.
Chúc các bạn một tuần mới thật nhiều năng lượng và làm được điều mình muốn.
À, suýt nữa thì mình quên mất một chi tiết nhỏ nhưng cực kỳ quan trọng.
Bạn thấy đấy, vấn đề hoá ra không nằm ở thời gian, mà nằm ở sự ưu tiên.
Có một câu nói mình rất thích, và mình muốn đọc tặng bạn trước khi kết thúc.
Thú thật với các bạn, tập này mình đã thu đi thu lại đến ba lần.
Nghe tới đây, mình đoán là bạn cũng đang nghĩ tới một ai đó, đúng không?
Vậy nhé, chúng ta dừng ở đây, và bạn nhớ giữ gìn sức khoẻ.`],
  ['Câu hỏi & cảm xúc', `
Bạn đã bao giờ dừng lại và tự hỏi, mình thật sự muốn điều gì chưa?
Tại sao có những người càng bận rộn lại càng làm được nhiều việc hơn?
Thật không thể tin nổi, chỉ sau ba tháng mà mọi thứ đã khác đi nhiều đến vậy!
Ôi, giá mà tôi biết điều này sớm hơn mười năm thì tốt biết mấy.
Liệu chúng ta có đang quá vội vàng khi đánh giá một con người không?
Tuyệt vời! Đây chính xác là kết quả mà cả nhóm đã mong chờ bấy lâu nay.
Chẳng lẽ lại bỏ cuộc khi chỉ còn cách đích có vài bước chân sao?
Tôi đã rất sợ, thật sự rất sợ, nhưng rồi tôi vẫn bước lên sân khấu.
Bạn có tin rằng một lời xin lỗi đúng lúc có thể cứu vãn cả một mối quan hệ?
Trời ơi, cảnh ở đây đẹp quá, đẹp hơn bất kỳ tấm ảnh nào tôi từng xem!
Điều gì khiến bạn thức dậy mỗi sáng mà vẫn thấy háo hức với công việc?
Buồn thật đấy, nhưng có lẽ đó là cách tốt nhất cho cả hai người.
Ai mà ngờ được, cậu bé nhút nhát ngày nào giờ đã thành một diễn giả tự tin.
Sao chúng ta không thử nhìn vấn đề này từ một góc hoàn toàn khác xem?
Tôi giận lắm, nhưng nghĩ lại thì mình cũng có phần sai trong chuyện đó.
Bạn nghĩ mình sẽ làm gì nếu biết chắc chắn rằng mình không thể thất bại?
Xúc động quá, cả khán phòng đứng dậy vỗ tay không ngớt suốt mấy phút liền.
Chuyện gì sẽ xảy ra nếu ngày mai tất cả chúng ta cùng tắt điện thoại?
Thôi nào, cố thêm một chút nữa thôi, bạn sắp làm được rồi đấy!
Phải chăng chúng ta đã quen với sự tiện lợi đến mức quên mất niềm vui của chờ đợi?
Tôi nhẹ cả người khi nghe bác sĩ nói rằng mọi chỉ số đều bình thường.
Có khi nào bạn thấy cô đơn ngay cả khi đang ở giữa rất nhiều người không?
Không, tôi không đồng ý với cách làm đó, và tôi sẽ nói rõ lý do.
Thật may mắn biết bao khi trong đời có được một người bạn hiểu mình.
Vậy rốt cuộc, thành công là đến được đích, hay là dám bắt đầu?
Hồi hộp quá, chỉ còn mười giây nữa là có kết quả cuối cùng!
Bạn còn nhớ lần gần nhất mình cười thật to là khi nào không?
Tiếc thật, nếu trời không mưa thì buổi dã ngoại đã trọn vẹn hơn nhiều.
Lạ nhỉ, càng lớn người ta lại càng thèm được nghe một lời khen giản dị.
Và bạn biết không, hoá ra câu trả lời đã nằm sẵn ở đó từ đầu.`],
  ['Số liệu & tin tức', `
Theo thống kê mới nhất, cả nước hiện có hơn bảy mươi triệu người dùng mạng xã hội.
Giá xăng trong nước được điều chỉnh giảm gần năm trăm đồng mỗi lít từ chiều nay.
Nhiệt độ tại Hà Nội hôm nay cao nhất ba mươi tư độ, chiều tối có mưa rào.
Kim ngạch xuất khẩu nông sản trong chín tháng đầu năm đạt hơn bốn mươi tỉ đô la.
Chuyến tàu khởi hành lúc bảy giờ mười lăm và dự kiến đến nơi vào giữa trưa.
Khoảng sáu mươi phần trăm người được hỏi cho biết họ ngủ ít hơn bảy tiếng mỗi đêm.
Tuyến đường dài hai mươi ba ki lô mét này sẽ được thông xe vào cuối tháng Mười Hai.
Thành phố ghi nhận thêm một nghìn hai trăm doanh nghiệp thành lập mới trong quý vừa qua.
Lãi suất tiết kiệm kỳ hạn mười hai tháng hiện dao động quanh mức năm phẩy năm phần trăm.
Đội tuyển giành chiến thắng với tỉ số ba không, ghi tên mình vào trận chung kết.
Dân số thế giới đã vượt mốc tám tỉ người vào cuối năm hai nghìn không trăm hai mươi hai.
Lượng khách quốc tế đến Việt Nam tăng hai mươi phần trăm so với cùng kỳ năm ngoái.
Một hộ gia đình trung bình tiêu thụ khoảng hai trăm số điện mỗi tháng.
Buổi hoà nhạc thu hút hơn bốn mươi nghìn khán giả, vé bán hết chỉ trong mười phút.
Tỉ lệ thất nghiệp ở thành thị giảm xuống còn hai phẩy sáu phần trăm.
Cơn bão số ba dự kiến đổ bộ vào đất liền trong khoảng mười hai đến hai mươi tư giờ tới.
Sản lượng lúa cả năm ước đạt bốn mươi ba triệu tấn, đủ cho tiêu dùng và xuất khẩu.
Sân bay mới có công suất phục vụ hai mươi lăm triệu lượt hành khách mỗi năm.
Chỉ số chất lượng không khí sáng nay ở mức một trăm năm mươi, không tốt cho sức khoẻ.
Dự án có tổng vốn đầu tư gần mười lăm nghìn tỉ đồng, thi công trong ba năm.
Học sinh cả nước sẽ bước vào năm học mới từ ngày mùng năm tháng Chín.
Cứ mười người trưởng thành thì có ba người gặp vấn đề về huyết áp.
Doanh thu thương mại điện tử dự báo cán mốc hai mươi lăm tỉ đô la vào năm sau.
Trận động đất mạnh năm phẩy hai độ xảy ra lúc hai giờ sáng, chưa ghi nhận thiệt hại.
Giá vàng trong nước sáng nay tăng thêm ba trăm nghìn đồng mỗi lượng.
Hơn một nửa số người trẻ cho biết họ muốn tự kinh doanh trước tuổi ba mươi.
Cây cầu dài một nghìn năm trăm mét, rộng sáu làn xe, nối liền hai bờ sông.
Thời gian chờ khám bệnh trung bình đã giảm từ hai tiếng xuống còn bốn mươi phút.
Lượng mưa tháng này cao hơn trung bình nhiều năm khoảng ba mươi phần trăm.
Trên đây là những thông tin đáng chú ý nhất trong bản tin sáng hôm nay.`],
  ['Kể chuyện', `
Ngày xửa ngày xưa, ở một ngôi làng nhỏ dưới chân núi, có một cậu bé rất thích kể chuyện.
Đêm ấy trăng sáng vằng vặc, cả khu rừng im phăng phắc như đang nín thở.
Bà cụ chậm rãi mở chiếc hộp gỗ cũ, bên trong chỉ có một lá thư đã ố vàng.
Hắn nhìn quanh một lượt, hạ giọng thì thầm, chuyện này tuyệt đối không được nói với ai.
Con thuyền nhỏ chòng chành giữa sóng lớn, nhưng người lái đò vẫn bình thản lạ thường.
Cô gái bật cười, tiếng cười trong veo làm cả gian phòng như sáng bừng lên.
Bỗng nhiên, từ phía cuối hành lang vọng lại tiếng bước chân nặng nề.
Người lính già đặt tay lên vai cậu, nói khẽ, con cứ đi đi, đừng ngoảnh lại.
Mùa đông năm đó lạnh đến mức mặt hồ đóng thành một lớp băng mỏng.
Cậu chạy, chạy mãi, cho đến khi ánh đèn của ngôi làng hiện ra sau rặng tre.
Trong túi anh chỉ còn đúng hai mươi nghìn đồng và một tấm vé tàu một chiều.
Ông lão mỉm cười hiền hậu, đôi mắt nheo lại sau cặp kính đã trầy xước.
Cánh cửa kẽo kẹt mở ra, để lộ một căn phòng phủ đầy bụi và mạng nhện.
Nàng công chúa không hề yếu đuối như người ta vẫn thường kể trong truyện.
Tiếng sấm rền vang, và cơn mưa đầu mùa trút xuống mái tôn như thác đổ.
Hai anh em nhìn nhau, không ai nói gì, nhưng cả hai đều hiểu.
Rồi một buổi sáng nọ, lá thư mà cô mong chờ suốt ba năm cuối cùng cũng đến.
Lão phú ông giật mình, mồ hôi vã ra như tắm, lắp bắp mãi không thành lời.
Chú mèo mướp rón rén từng bước, mắt không rời con chuột nhắt trong góc bếp.
Đó là lần đầu tiên trong đời, cậu thấy cha mình khóc.
Ngọn nến chập chờn rồi tắt hẳn, bỏ lại căn phòng chìm trong bóng tối.
Bà kể rằng thuở ấy, cả làng chỉ có duy nhất một chiếc đài cũ để nghe tin tức.
Chàng trai hít một hơi thật sâu, rồi gõ cửa ba tiếng.
Từ hôm đó trở đi, không ai còn nhìn thấy người lạ mặt ấy nữa.
Con đường mòn dẫn họ tới một thung lũng mà chưa tấm bản đồ nào ghi lại.
Cô bé ôm chặt con búp bê vải, thì thầm, mình sẽ không sợ đâu.
Tiếng gà gáy báo hiệu một ngày mới, và cũng là ngày họ phải lên đường.
Người thợ mộc già cặm cụi suốt đêm để kịp hoàn thành món quà cho cháu.
Mãi về sau này, anh mới hiểu hết ý nghĩa của câu nói năm ấy.
Và họ sống bên nhau hạnh phúc, cho đến tận cuối đời.`],
  ['Quan điểm & lời khuyên', `
Theo tôi, kỷ luật không phải là sự gò bó, mà chính là một dạng tự do.
Đừng so sánh chương đầu của mình với chương hai mươi của người khác.
Điều tôi rút ra được sau mười năm đi làm là, thái độ quan trọng hơn trình độ.
Muốn đi nhanh thì đi một mình, còn muốn đi xa thì hãy đi cùng nhau.
Bạn không cần phải giỏi mới bắt đầu, nhưng phải bắt đầu thì mới có thể giỏi.
Thay vì hỏi tại sao chuyện này xảy ra với tôi, hãy hỏi tôi học được gì từ nó.
Tiền bạc rất quan trọng, nhưng thời gian và sức khoẻ thì không mua lại được.
Hãy đọc sách không phải để biết nhiều hơn, mà để nghĩ sâu hơn.
Một kế hoạch tạm ổn được thực hiện hôm nay tốt hơn một kế hoạch hoàn hảo để đến tuần sau.
Tôi cho rằng nói không đúng lúc cũng là một kỹ năng cần phải rèn luyện.
Thất bại không đáng sợ, đáng sợ là không rút ra được điều gì sau thất bại.
Nếu bạn là người giỏi nhất trong phòng, có lẽ bạn đang ngồi nhầm phòng.
Hãy đầu tư cho bản thân trước, vì đó là khoản đầu tư không bao giờ lỗ.
Im lặng lắng nghe đôi khi lại là câu trả lời thông minh nhất.
Đừng đợi có động lực rồi mới làm, cứ làm đi rồi động lực sẽ tới.
Người thành công không làm nhiều việc hơn, họ chỉ bỏ bớt những việc không cần thiết.
Sự tử tế không tốn kém gì cả, nhưng giá trị nó mang lại thì rất lớn.
Viết ra giấy mục tiêu của mình, và bạn đã đi được nửa chặng đường.
Hãy chọn công việc khiến bạn muốn học thêm, chứ không chỉ khiến bạn kiếm thêm.
Thói quen trì hoãn thường bắt nguồn từ nỗi sợ, chứ không phải từ sự lười biếng.
Cách nhanh nhất để học một điều gì đó là thử dạy lại nó cho người khác.
Đừng để một ngày tồi tệ khiến bạn nghĩ rằng mình có một cuộc đời tồi tệ.
Tôi tin rằng ai cũng có một câu chuyện đáng được lắng nghe.
Tập trung vào những gì bạn kiểm soát được, phần còn lại hãy học cách buông.
Nghỉ ngơi không phải là lười biếng, nghỉ ngơi là một phần của công việc.
Lời khen chân thành là món quà rẻ nhất mà cũng quý nhất.
Hãy sống sao cho phiên bản mười tuổi của bạn nhìn vào sẽ thấy tự hào.
Mỗi lựa chọn đều có cái giá của nó, kể cả việc không lựa chọn gì.
Khiêm tốn không có nghĩa là nghĩ ít về mình, mà là nghĩ về mình ít hơn.
Cuối cùng thì, mỗi ngày tốt hơn một phần trăm cũng đã là rất đủ.`],
];

export const TRAIN_STAGE = 5;
export const TRAIN_LESSONS: Lesson[] = SETS.map(([title, body], n) => ({
  id: `train-${n + 1}`, stage: TRAIN_STAGE, title,
  goal: 'Câu để train model riêng. Đọc tự nhiên đúng chất giọng bạn muốn dùng; vấp một chữ cũng nên thu lại, vì model học đúng từng chữ.',
  items: body.trim().split('\n').map((text, i) => ({ id: `train-${n + 1}-${i + 1}`, text: text.trim() })),
}));
