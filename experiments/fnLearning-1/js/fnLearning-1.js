function make_slides(f) {
  var   slides = {};

  slides.i0 = slide({
     name : "i0",
     start: function() {
      exp.startT = Date.now();
     }
  });

  slides.instructions = slide({
    name : "instructions",
    button : function() {
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.fn_learning = slide({
    name : "fn_learning",
    present : _.shuffle([
      {
        "question": "How tall is tall?"
      },
      {
        "question": "How tall is tall again?"
      }
    ]),
    present_handle : function(stim) {
      $(".err").hide();
      this.stim = stim;

      $("#vertical_question").html(stim.question);
      $("#sliders").empty();

      $("#sliders").append("<td><svg id='svg_bug'></svg></td>");
      $("#sliders").append("<td><svg id='svg_tree'></svg></td>");
      $("#sliders").append("<td><div id='vslider0' class='vertical_slider'>|</div></td>");
      var scale = 1;

      Ecosystem.draw("bug",
      {
        "tar1":true,
        "tar2":true,
        "prop1":1,
        "prop2":1
      }, "svg_bug", scale)

      Ecosystem.draw("tree",
      {
        "tar1":true,
        "tar2":true,
        "prop1":1,
        "prop2":1
      }, "svg_tree", scale)
      
      this.init_sliders();
      exp.sliderPost = [];
    },
    button : function() {
      if (exp.sliderPost.length == 0) {
        $(".err").show();
      } else {
        this.log_responses();
        _stream.apply(this);
      }
    },
    init_sliders : function() {
      utils.make_slider("#vslider0", this.make_slider_callback(), "vertical");
    },
    make_slider_callback : function() {
      return function(event, ui) {
        exp.sliderPost[0] = ui.value;
      };
    },
    log_responses : function() {
      exp.data_trials.push({
        "trial_type" : "fnLearning",
        "question" : this.stim.question,
        "response" : exp.sliderPost[0]
      });
    },
  });

  slides.subj_info =  slide({
    name : "subj_info",
    submit : function(e){
      //if (e.preventDefault) e.preventDefault(); // I don't know what this means.
      exp.subj_data = {
        language : $("#language").val(),
        enjoyment : $("#enjoyment").val(),
        asses : $('input[name="assess"]:checked').val(),
        age : $("#age").val(),
        gender : $("#gender").val(),
        education : $("#education").val(),
        comments : $("#comments").val(),
      };
      exp.go(); //use exp.go() if and only if there is no "present" data.
    }
  });

  slides.thanks = slide({
    name : "thanks",
    start : function() {
      exp.data= {
          "trials" : exp.data_trials,
          "catch_trials" : exp.catch_trials,
          "system" : exp.system,
          "condition" : exp.condition,
          "subject_information" : exp.subj_data,
          "time_in_minutes" : (Date.now() - exp.startT)/60000
      };
      setTimeout(function() {turk.submit(exp.data);}, 1000);
    }
  });

  return slides;
}

/// init ///
function init() {
  exp.trials = [];
  exp.catch_trials = [];
  exp.condition = _.sample(["CONDITION 1", "condition 2"]); //can randomize between subject conditions here
  exp.system = {
      Browser : BrowserDetect.browser,
      OS : BrowserDetect.OS,
      screenH: screen.height,
      screenUH: exp.height,
      screenW: screen.width,
      screenUW: exp.width
    };
  //blocks of the experiment:
  exp.structure=[ "fn_learning","i0", "instructions", 'subj_info', 'thanks'];

  exp.data_trials = [];
  //make corresponding slides:
  exp.slides = make_slides(exp);

  exp.nQs = utils.get_exp_length(); //this does not work if there are stacks of stims (but does work for an experiment with this structure)
                    //relies on structure and slides being defined

  $('.slide').hide(); //hide everything

  //make sure turkers have accepted HIT (or you're not in mturk)
  $("#start_button").click(function() {
    if (turk.previewMode) {
      $("#mustaccept").show();
    } else {
      $("#start_button").click(function() {$("#mustaccept").show();});
      exp.go();
    }
  });

  exp.go(); //show first slide
}
